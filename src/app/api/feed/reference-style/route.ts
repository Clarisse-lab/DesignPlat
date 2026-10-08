import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { styleFromReference } from "@/lib/ai/reference-style";
import { GenerationError } from "@/lib/ai/claude";
import { FEED_CANVAS_SIZES } from "@/lib/formats";

export const runtime = "nodejs";
export const maxDuration = 300;

const requestSchema = z.object({
  image: z
    .string()
    .max(6_000_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/),
  size: z.enum(FEED_CANVAS_SIZES),
});

/** POST: recebe uma imagem de referência e devolve estilo + layout personalizado criados pela IA. */
export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Envie uma imagem PNG, JPG ou WEBP." }, { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json(
      { error: "Copiar o estilo com IA precisa da chave da Anthropic (ANTHROPIC_API_KEY) configurada no servidor." },
      { status: 503 },
    );
  }

  const [header, data] = parsed.data.image.split(",");
  const mediaType = header.slice(5, header.indexOf(";")) as "image/jpeg" | "image/png" | "image/webp";

  try {
    return NextResponse.json(await styleFromReference({ imageBase64: data, mediaType, size: parsed.data.size }));
  } catch (error) {
    if (error instanceof GenerationError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ error: "Chave da Anthropic inválida (ANTHROPIC_API_KEY)." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Limite de uso da IA atingido. Tente em instantes." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[feed/reference-style] erro da API:", error.status, error.message);
      return NextResponse.json({ error: "A IA está indisponível agora. Tente novamente." }, { status: 502 });
    }
    console.error("[feed/reference-style] erro inesperado:", error);
    return NextResponse.json({ error: "Erro inesperado ao analisar a referência." }, { status: 500 });
  }
}
