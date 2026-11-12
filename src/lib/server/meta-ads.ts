import "server-only";
// Leitura do Meta Ads (só leitura): os insights das contas de anúncio do cliente no período e no anterior.
// O token da Meta fica só no Supabase: os números vêm pela função meta-ads (a mesma chave do coletor).
// Contas de cada cliente: clientes.meta_contas (Supabase), escolhidas na aba Relatórios.

import { periodoAnterior } from "../relatorio/calc";
import { somarInsights, type InsightMeta } from "../relatorio/meta";
import type { DadosSemana, TipoPeriodo } from "../relatorio/tipos";
import { callFunction, rest } from "./supabase";

export interface ContaMeta {
  id: string;
  nome: string;
  ativa: boolean;
}

/** Contas de anúncio que o token da Meta enxerga (para escolher as de cada cliente). */
export async function contasDisponiveis(): Promise<ContaMeta[]> {
  const r = await callFunction<{ contas: ContaMeta[] }>("meta-ads", "?acao=contas");
  return [...r.contas].sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome));
}

export async function contasDoCliente(cliente: string): Promise<string[]> {
  const rows = await rest<{ meta_contas: string[] | null }[]>(`clientes?slug=eq.${cliente}&select=meta_contas&limit=1`).catch(() => []);
  return rows[0]?.meta_contas ?? [];
}

export async function salvarContas(cliente: string, contas: string[]): Promise<void> {
  await rest(`clientes?slug=eq.${cliente}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ meta_contas: contas }),
  });
}

async function insights(contas: string[], since: string, until: string) {
  const r = await callFunction<{ linhas: InsightMeta[] }>("meta-ads", "?acao=insights", { contas, since, until });
  return somarInsights(r.linhas);
}

/** Tráfego do período e do anterior, somando as contas do cliente. Null sem conta ou se o Meta falhar. */
export async function trafegoDoCliente(cliente: string, tipo: TipoPeriodo, inicio: string, fim: string): Promise<DadosSemana["meta_ads"]> {
  const contas = await contasDoCliente(cliente);
  if (!contas.length) return null;
  try {
    const ant = periodoAnterior(tipo, inicio);
    const [atual, anterior] = await Promise.all([insights(contas, inicio, fim), insights(contas, ant.inicio, ant.fim).catch(() => null)]);
    return { atual, anterior, contas, em: new Date().toISOString() };
  } catch (error) {
    // Sem o Meta o relatório continua com o tráfego digitado.
    console.error("[relatorios] meta ads:", error instanceof Error ? error.message : error);
    return null;
  }
}
