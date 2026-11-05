// Gera as telas do carrossel com o Claude a partir de uma pauta do Motor de Conteúdo (copy aprovada)
// ou de um tema. O custo vai para uso_ia (tipo "carrossel"), como as gerações do Escritório.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GenerationError } from "@/lib/ai/claude";
import { generateStudioCarousel } from "@/lib/ai/carousel-from-copy";
import { isResponse, requireMember } from "@/lib/server/auth";
import { rest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const maxDuration = 180;

const schema = z
  .object({
    pautaId: z.number().int().positive().nullish(),
    tema: z.string().trim().max(4000).nullish(),
    nome: z.string().max(80),
    handle: z.string().max(40),
    clienteSlug: z.string().regex(/^[a-z0-9-]{2,60}$/).nullish(),
    slides: z.number().int().min(3).max(12).nullish(),
  })
  .refine((v) => v.pautaId || (v.tema && v.tema.length >= 5), { message: "Escolha uma pauta ou escreva o tema." });

interface PautaRow {
  titulo: string;
  formato: string | null;
  angulo: string | null;
  copy: string | null;
  cliente_slug: string;
}

export async function POST(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "Configure ANTHROPIC_API_KEY no Railway (a mesma do Escritório)." }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Pedido inválido." }, { status: 400 });
  const { pautaId, tema, nome, handle, clienteSlug, slides } = parsed.data;

  let pauta: PautaRow | null = null;
  if (pautaId) {
    const rows = await rest<PautaRow[]>(`pautas?id=eq.${pautaId}&select=titulo,formato,angulo,copy,cliente_slug`).catch(() => []);
    pauta = rows[0] ?? null;
    if (!pauta) return NextResponse.json({ error: "Pauta não encontrada." }, { status: 404 });
    if (!pauta.copy) return NextResponse.json({ error: "Essa pauta ainda não tem copy. Gere a copy no Motor de Conteúdo primeiro." }, { status: 400 });
  }

  try {
    const result = await generateStudioCarousel({
      nome,
      handle,
      slideCount: slides ?? null,
      pauta: pauta ? { titulo: pauta.titulo, formato: pauta.formato, angulo: pauta.angulo, copy: pauta.copy! } : null,
      tema: tema ?? null,
    });
    await rest("uso_ia", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        email: member.email || null,
        tipo: "carrossel",
        cliente_slug: pauta?.cliente_slug ?? clienteSlug ?? null,
        modelo: result.model,
        tokens_entrada: result.inputTokens,
        tokens_saida: result.outputTokens,
        custo_usd: result.costUsd.toFixed(4),
      }),
    }).catch((error) => console.error("[estudio/gerar] não registrou o custo:", error));
    return NextResponse.json({ ...result.carousel, custo_usd: Math.round(result.costUsd * 1000) / 1000 });
  } catch (error) {
    if (error instanceof GenerationError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof Anthropic.APIError) {
      console.error("[estudio/gerar] API:", error.status, error.message);
      return NextResponse.json({ error: error.status === 429 ? "A API do Claude está ocupada. Tente em 1 minuto." : "Falha na API do Claude." }, { status: 502 });
    }
    console.error("[estudio/gerar]", error);
    return NextResponse.json({ error: "Falha ao gerar o carrossel." }, { status: 500 });
  }
}
