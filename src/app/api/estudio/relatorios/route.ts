// Relatório semanal do cliente (aba Relatórios).
// GET: clientes ativos com o relatório da última semana · GET ?cliente=slug: semanas, relatórios e o link fixo.
// POST { cliente, semana_inicio, notas? }: coleta os números, a IA escreve os textos e grava como rascunho.
// O custo da IA vai para uso_ia (tipo "relatorio").

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { GenerationError } from "@/lib/ai/claude";
import { escreverTextos } from "@/lib/ai/relatorio";
import { semanasRecentes, somaDias, ultimaSemanaCompleta } from "@/lib/relatorio/calc";
import type { RelatorioSemana } from "@/lib/relatorio/tipos";
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
  const cliente = new URL(request.url).searchParams.get("cliente");
  try {
    if (!cliente) {
      const { inicio } = ultimaSemanaCompleta();
      const [clientes, semana] = await Promise.all([
        rest<{ slug: string; nome: string }[]>("clientes?ativo=is.true&slug=neq.mantora&select=slug,nome&order=nome"),
        rest<{ cliente_slug: string; status: string; visualizacoes: number }[]>(
          `relatorios_semanais?semana_inicio=eq.${inicio}&select=cliente_slug,status,visualizacoes`,
        ),
      ]);
      const porCliente = new Map(semana.map((r) => [r.cliente_slug, r]));
      return NextResponse.json({
        semana: ultimaSemanaCompleta(),
        clientes: clientes.map((c) => ({ ...c, status: porCliente.get(c.slug)?.status ?? null, visualizacoes: porCliente.get(c.slug)?.visualizacoes ?? 0 })),
      });
    }
    if (!SLUG.test(cliente)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
    const [relatorios, token] = await Promise.all([doCliente(cliente), linkDoCliente(cliente)]);
    const porSemana = new Map(relatorios.map((r) => [r.semana_inicio, r]));
    return NextResponse.json({
      token,
      semanas: semanasRecentes(8).map((s) => {
        const r = porSemana.get(s.inicio);
        return { ...s, id: r?.id ?? null, status: r?.status ?? null, visualizacoes: r?.visualizacoes ?? 0, atualizado_em: r?.atualizado_em ?? null };
      }),
    });
  } catch (error) {
    console.error("[estudio/relatorios]", error);
    return NextResponse.json({ error: "Não foi possível carregar os relatórios." }, { status: 502 });
  }
}

const postSchema = z.object({
  cliente: z.string().regex(SLUG),
  semana_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().max(3000).nullish(),
});

/** Gera (ou refaz) o relatório da semana: números novos + textos novos. Mantém tráfego, entregas e seções da equipe. */
export async function POST(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escolha o cliente e a semana." }, { status: 400 });
  const { cliente, semana_inicio } = parsed.data;
  if (new Date(`${semana_inicio}T12:00:00Z`).getUTCDay() !== 1) return NextResponse.json({ error: "A semana começa na segunda-feira." }, { status: 400 });
  try {
    const existente = await daSemana(cliente, semana_inicio);
    const id = existente?.id ?? crypto.randomUUID();
    const notas = parsed.data.notas !== undefined ? (parsed.data.notas ?? null) : (existente?.notas ?? null);
    const [dados, nome] = await Promise.all([coletar(cliente, semana_inicio, id), nomeDoCliente(cliente)]);
    const trafego = existente?.trafego ?? {};
    const entregas = existente?.entregas ?? [];
    const result = await escreverTextos({ cliente: nome, inicio: semana_inicio, fim: somaDias(semana_inicio, 6), dados, trafego, entregas, notas });
    const row: Partial<RelatorioSemana> & { cliente_slug: string; semana_inicio: string } = {
      id,
      cliente_slug: cliente,
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
