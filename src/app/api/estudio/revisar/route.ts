// Revisão de português com IA (telas + legenda). O custo vai para uso_ia (tipo "revisao").

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GenerationError } from "@/lib/ai/claude";
import { proofread } from "@/lib/ai/proofread";
import { isResponse, requireMember } from "@/lib/server/auth";
import { rest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const maxDuration = 120;

const schema = z.object({
  telas: z.array(z.array(z.string().max(3000)).max(30)).max(20),
  legenda: z.string().max(5000).default(""),
  cliente: z.string().regex(/^[a-z0-9-]{2,60}$/).nullish(),
});

export async function POST(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Textos inválidos para revisar." }, { status: 400 });
  const { telas, legenda, cliente } = parsed.data;
  if (!telas.some((t) => t.some((x) => x.trim())) && !legenda.trim()) return NextResponse.json({ erros: [] });
  try {
    const result = await proofread({ telas, legenda });
    await rest("uso_ia", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        email: member.email || null,
        tipo: "revisao",
        cliente_slug: cliente ?? null,
        modelo: result.model,
        tokens_entrada: result.inputTokens,
        tokens_saida: result.outputTokens,
        custo_usd: result.costUsd.toFixed(4),
      }),
    }).catch((error) => console.error("[estudio/revisar] não registrou o custo:", error));
    return NextResponse.json({ erros: result.erros, custo_usd: Math.round(result.costUsd * 1000) / 1000 });
  } catch (error) {
    if (error instanceof GenerationError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof Anthropic.APIError) {
      console.error("[estudio/revisar] API:", error.status, error.message);
      return NextResponse.json({ error: "A IA está indisponível agora. Tente novamente." }, { status: 502 });
    }
    console.error("[estudio/revisar]", error);
    return NextResponse.json({ error: "Falha ao revisar." }, { status: 500 });
  }
}
