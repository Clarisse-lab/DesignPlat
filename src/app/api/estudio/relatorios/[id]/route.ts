// Um relatório semanal (aba Relatórios).
// GET: relatório + capas + nome do cliente (prévia).
// PUT: salva o que a equipe editou (textos, tráfego, entregas, seções, notas) e publica ou despublica.
// POST { acao: "reescrever" }: a IA reescreve os textos com os números atuais e o que a equipe acrescentou.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GenerationError } from "@/lib/ai/claude";
import { escreverTextos } from "@/lib/ai/relatorio";
import type { RelatorioSemana } from "@/lib/relatorio/tipos";
import { isResponse, requireMember } from "@/lib/server/auth";
import { atualizar, carregar, linkDoCliente, nomeDoCliente, urlsDasImagens } from "@/lib/server/relatorios";
import { rest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/;

export async function GET(request: Request, { params }: Params) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
  try {
    const relatorio = await carregar(id);
    if (!relatorio) return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
    const [capas, nome, token] = await Promise.all([urlsDasImagens(relatorio.dados), nomeDoCliente(relatorio.cliente_slug), linkDoCliente(relatorio.cliente_slug)]);
    return NextResponse.json({ relatorio, capas, cliente: nome, token });
  } catch (error) {
    console.error("[estudio/relatorios/id]", error);
    return NextResponse.json({ error: "Não foi possível abrir o relatório." }, { status: 502 });
  }
}

const num = z.number().finite().min(0).max(1e10).nullish();
const texto = (max: number) => z.string().trim().max(max);
const putSchema = z.object({
  textos: z
    .object({
      titulo: texto(140),
      resumo: texto(1200),
      destaques: z.array(z.object({ titulo: texto(80), texto: texto(400) })).max(4),
      proximos: z.array(texto(240)).max(6),
    })
    .optional(),
  trafego: z
    .object({ investimento: num, leads: num, cpl: num, vendas: num, faturamento: num, roas: num, observacao: z.string().trim().max(400).nullish() })
    .optional(),
  entregas: z.array(texto(200)).max(20).optional(),
  secoes: z.record(z.string(), z.boolean()).optional(),
  notas: z.string().max(3000).nullish(),
  status: z.enum(["rascunho", "publicado"]).optional(),
});

export async function PUT(request: Request, { params }: Params) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Algum campo está grande demais ou inválido." }, { status: 400 });
  const { status, ...resto } = parsed.data;
  const campos: Partial<RelatorioSemana> = { ...resto } as Partial<RelatorioSemana>;
  if (campos.entregas) campos.entregas = campos.entregas.filter(Boolean);
  if (status) {
    campos.status = status;
    campos.publicado_em = status === "publicado" ? new Date().toISOString() : null;
  }
  try {
    const relatorio = await atualizar(id, campos, member.email || null);
    return NextResponse.json({ relatorio });
  } catch (error) {
    console.error("[estudio/relatorios/id] salvar:", error);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 502 });
  }
}

export async function POST(request: Request, { params }: Params) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
  const body = (await request.json().catch(() => null)) as { acao?: string } | null;
  if (body?.acao !== "reescrever") return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  try {
    const atual = await carregar(id);
    if (!atual) return NextResponse.json({ error: "Relatório não encontrado." }, { status: 404 });
    const result = await escreverTextos({
      cliente: await nomeDoCliente(atual.cliente_slug),
      inicio: atual.semana_inicio,
      fim: atual.semana_fim,
      dados: atual.dados,
      trafego: atual.trafego ?? {},
      entregas: atual.entregas ?? [],
      notas: atual.notas,
    });
    const relatorio = await atualizar(id, { textos: result.textos }, member.email || null);
    await rest("uso_ia", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        email: member.email || null,
        tipo: "relatorio",
        cliente_slug: atual.cliente_slug,
        modelo: result.model,
        tokens_entrada: result.inputTokens,
        tokens_saida: result.outputTokens,
        custo_usd: result.costUsd.toFixed(4),
      }),
    }).catch((error) => console.error("[estudio/relatorios/id] não registrou o custo:", error));
    return NextResponse.json({ relatorio, custo_usd: Math.round(result.costUsd * 1000) / 1000 });
  } catch (error) {
    if (error instanceof GenerationError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof Anthropic.APIError) {
      console.error("[estudio/relatorios/id] API:", error.status, error.message);
      return NextResponse.json({ error: error.status === 429 ? "A API do Claude está ocupada. Tente em 1 minuto." : "Falha na API do Claude." }, { status: 502 });
    }
    console.error("[estudio/relatorios/id]", error);
    return NextResponse.json({ error: "Não foi possível reescrever." }, { status: 500 });
  }
}
