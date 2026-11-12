// Relatório do cliente, semanal ou mensal (aba Relatórios).
// GET ?tipo=semana|mes: clientes ativos com o relatório do último período completo.
// GET ?cliente=slug: semanas e meses recentes, com o relatório de cada um, e o link fixo.
// POST { cliente, tipo, semana_inicio, notas? }: coleta os números, a IA escreve os textos e grava como rascunho.
// O custo da IA vai para uso_ia (tipo "relatorio").

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GenerationError } from "@/lib/ai/claude";
import { escreverTextos } from "@/lib/ai/relatorio";
import { fimDoPeriodo, inicioValido, periodosRecentes } from "@/lib/relatorio/calc";
import type { RelatorioSemana, TipoPeriodo } from "@/lib/relatorio/tipos";
import { isResponse, requireMember } from "@/lib/server/auth";
import { coletar, daSemana, doCliente, linkDoCliente, nomeDoCliente, salvar, urlsDasImagens } from "@/lib/server/relatorios";
import { rest, supabaseConfigured } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const SLUG = /^[a-z0-9-]{2,60}$/;

export async function GET(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  if (!supabaseConfigured()) return NextResponse.json({ error: "Configure o Supabase." }, { status: 503 });
  const busca = new URL(request.url).searchParams;
  const cliente = busca.get("cliente");
  const tipo: TipoPeriodo = busca.get("tipo") === "mes" ? "mes" : "semana";
  try {
    if (!cliente) {
      const [ref] = periodosRecentes(tipo, 1);
      const [clientes, periodo] = await Promise.all([
        rest<{ slug: string; nome: string }[]>("clientes?ativo=is.true&slug=neq.mantora&select=slug,nome&order=nome"),
        rest<{ cliente_slug: string; status: string; visualizacoes: number }[]>(
          `relatorios_semanais?tipo=eq.${tipo}&semana_inicio=eq.${ref.inicio}&select=cliente_slug,status,visualizacoes`,
        ),
      ]);
      const porCliente = new Map(periodo.map((r) => [r.cliente_slug, r]));
      return NextResponse.json({
        tipo,
        semana: ref,
        clientes: clientes.map((c) => ({ ...c, status: porCliente.get(c.slug)?.status ?? null, visualizacoes: porCliente.get(c.slug)?.visualizacoes ?? 0 })),
      });
    }
    if (!SLUG.test(cliente)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    const [relatorios, token] = await Promise.all([doCliente(cliente), linkDoCliente(cliente)]);
    const chave = (t: TipoPeriodo, inicio: string) => `${t}:${inicio}`;
    const porPeriodo = new Map(relatorios.map((r) => [chave(r.tipo, r.semana_inicio), r]));
    const linha = (t: TipoPeriodo) => (s: { inicio: string; fim: string }) => {
      const r = porPeriodo.get(chave(t, s.inicio));
      return { ...s, tipo: t, id: r?.id ?? null, status: r?.status ?? null, visualizacoes: r?.visualizacoes ?? 0, atualizado_em: r?.atualizado_em ?? null };
    };
    return NextResponse.json({ token, semanas: periodosRecentes("semana", 8).map(linha("semana")), meses: periodosRecentes("mes", 6).map(linha("mes")) });
  } catch (error) {
    console.error("[estudio/relatorios]", error);
    return NextResponse.json({ error: "Não foi possível carregar os relatórios." }, { status: 502 });
  }
}

const postSchema = z.object({
  cliente: z.string().regex(SLUG),
  tipo: z.enum(["semana", "mes"]).default("semana"),
  semana_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().max(3000).nullish(),
});

/** Gera (ou refaz) o relatório da semana: números novos + textos novos. Mantém tráfego, entregas e seções da equipe. */
export async function POST(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escolha o cliente e o período." }, { status: 400 });
  const { cliente, tipo, semana_inicio } = parsed.data;
  if (!inicioValido(tipo, semana_inicio)) {
    return NextResponse.json({ error: tipo === "mes" ? "O mês começa no dia 1." : "A semana começa na segunda-feira." }, { status: 400 });
  }
  try {
    const existente = await daSemana(cliente, tipo, semana_inicio);
    const id = existente?.id ?? crypto.randomUUID();
    const notas = parsed.data.notas !== undefined ? (parsed.data.notas ?? null) : (existente?.notas ?? null);
    const [dados, nome] = await Promise.all([coletar(cliente, tipo, semana_inicio, id), nomeDoCliente(cliente)]);
    const trafego = existente?.trafego ?? {};
    const entregas = existente?.entregas ?? [];
    const result = await escreverTextos({ cliente: nome, tipo, inicio: semana_inicio, fim: fimDoPeriodo(tipo, semana_inicio), dados, trafego, entregas, notas });
    const row: Partial<RelatorioSemana> & { cliente_slug: string; tipo: TipoPeriodo; semana_inicio: string } = {
      id,
      cliente_slug: cliente,
      tipo,
      semana_inicio,
      dados,
      textos: result.textos,
      notas,
      ...(existente ? {} : { status: "rascunho" as const, trafego: {}, entregas: [], secoes: {} }),
    };
    const salvo = await salvar(row, member.email || null);
    await rest("uso_ia", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        email: member.email || null,
        tipo: "relatorio",
        cliente_slug: cliente,
        modelo: result.model,
        tokens_entrada: result.inputTokens,
        tokens_saida: result.outputTokens,
        custo_usd: result.costUsd.toFixed(4),
      }),
    }).catch((error) => console.error("[estudio/relatorios] não registrou o custo:", error));
    return NextResponse.json({ relatorio: salvo, capas: await urlsDasImagens(salvo.dados), custo_usd: Math.round(result.costUsd * 1000) / 1000 });
  } catch (error) {
    if (error instanceof GenerationError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof Anthropic.APIError) {
      console.error("[estudio/relatorios] API:", error.status, error.message);
      return NextResponse.json({ error: error.status === 429 ? "A API do Claude está ocupada. Tente em 1 minuto." : "Falha na API do Claude." }, { status: 502 });
    }
    console.error("[estudio/relatorios]", error);
    return NextResponse.json({ error: "Não foi possível gerar o relatório." }, { status: 500 });
  }
}
