import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { generateTweetCarousel, GenerationError } from "@/lib/ai/tweet-carousel";
import { generateRequestSchema } from "@/lib/tweet/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const parsed = generateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos para gerar o carrossel." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json({ error: "Configure ANTHROPIC_API_KEY no servidor para gerar com IA." }, { status: 500 });
  }

  try {
    const carousel = await generateTweetCarousel(parsed.data);
    return NextResponse.json(carousel);
  } catch (error) {
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Chave da Anthropic ausente ou inválida (ANTHROPIC_API_KEY)." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Limite de uso da IA atingido. Tente em instantes." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[tweet/generate] erro da API:", error.status, error.message);
      return NextResponse.json({ error: "A IA está indisponível agora. Tente novamente." }, { status: 502 });
    }
    console.error("[tweet/generate] erro inesperado:", error);
    return NextResponse.json({ error: "Erro inesperado ao gerar o carrossel." }, { status: 500 });
  }
}
