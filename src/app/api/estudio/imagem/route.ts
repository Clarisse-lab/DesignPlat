// Gera uma imagem com o Gemini para o slide (fundo, foto ou capa), com o rosto do cliente quando pedido.
// Custo de cada imagem vai para uso_ia (tipo "imagem"); passa do limite do mês, a rota recusa.

import { NextResponse } from "next/server";
import { z } from "zod";
import { CANVAS_SIZES, POST_CANVAS_SIZES } from "@/lib/formats";
import { isResponse, requireMember } from "@/lib/server/auth";
import { aspectFor, geminiConfigured, generateImage, IMAGE_MODEL, pricePerImage } from "@/lib/server/gemini";
import { rest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const maxDuration = 200;

const LIMIT_USD = () => Number(process.env.LIMITE_MENSAL_IMAGENS_USD) || 20;
const dataUrl = z.string().max(4_000_000).regex(/^data:image\/(png|jpeg|webp);base64,/);

const schema = z.object({
  prompt: z.string().trim().min(5).max(2000),
  size: z.enum(POST_CANVAS_SIZES),
  clienteSlug: z.string().regex(/^[a-z0-9-]{2,60}$/).nullish(),
  rostos: z.array(dataUrl).max(3).default([]),
  referencias: z.array(dataUrl).max(2).default([]),
  paleta: z.array(z.string().regex(/^#[0-9a-fA-F]{6}$/)).max(3).optional(),
  /** Editar esta imagem (modo "Editar a imagem atual"). */
  base: dataUrl.nullish(),
  /** Proporção fixa (ex.: panorama do carrossel infinito); sem ela, segue o tamanho do slide. */
  proporcao: z.enum(["1:1", "4:5", "3:4", "9:16", "16:9", "21:9", "2:3", "3:2"]).optional(),
});

async function spentThisMonth(): Promise<number> {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const rows = await rest<{ custo_usd: string | number | null }[]>(
    `uso_ia?select=custo_usd&tipo=eq.imagem&quando=gte.${encodeURIComponent(start.toISOString())}`,
  );
  return rows.reduce((sum, r) => sum + Number(r.custo_usd || 0), 0);
}

export async function POST(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  if (!geminiConfigured()) return NextResponse.json({ error: "Configure GEMINI_API_KEY no Railway para gerar imagens." }, { status: 503 });

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.path.join(".") === "prompt" ? "Descreva a imagem com pelo menos 5 letras." : "Pedido inválido." }, { status: 400 });
  }
  const { prompt, size, clienteSlug, rostos, referencias, paleta, base, proporcao } = parsed.data;

  const limit = LIMIT_USD();
  const price = pricePerImage();
  let spent: number;
  try {
    spent = await spentThisMonth();
  } catch (error) {
    console.error("[estudio/imagem] não leu o gasto do mês:", error);
    return NextResponse.json({ error: "Não foi possível conferir o limite de gasto agora." }, { status: 503 });
  }
  if (spent + price > limit) {
    return NextResponse.json({ error: `O limite de imagens do mês (US$ ${limit}) foi atingido: já foram US$ ${spent.toFixed(2)}.` }, { status: 402 });
  }

  const { width, height } = CANVAS_SIZES[size];
  try {
    const image = await generateImage({ prompt, aspectRatio: proporcao ?? aspectFor(width, height), faces: rostos, references: referencias, paletteHint: paleta?.join(", "), base });
    await rest("uso_ia", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        email: member.email || null,
        tipo: "imagem",
        cliente_slug: clienteSlug ?? null,
        modelo: IMAGE_MODEL,
        tokens_entrada: image.inputTokens,
        tokens_saida: image.outputTokens,
        custo_usd: price.toFixed(4),
      }),
    }).catch((error) => console.error("[estudio/imagem] não registrou o custo:", error));
    return NextResponse.json({
      imagem: `data:${image.mimeType};base64,${image.base64}`,
      custo_usd: price,
      gasto_mes_usd: Math.round((spent + price) * 100) / 100,
      limite_usd: limit,
      modelo: IMAGE_MODEL,
    });
  } catch (error) {
    console.error("[estudio/imagem]", error);
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error).slice(0, 300) }, { status: 502 });
  }
}
