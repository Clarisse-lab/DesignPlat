import "server-only";
// Leitura do Meta Ads (só leitura): os insights das contas de anúncio do cliente no período e no anterior.
// Contas de cada cliente: clientes.meta_contas (Supabase), escolhidas na aba Relatórios.
// Precisa de META_ADS_TOKEN (token de usuário com ads_read e acesso às contas dos clientes); sem ele, o tráfego é digitado.

import { periodoAnterior } from "../relatorio/calc";
import { somarInsights, type InsightMeta } from "../relatorio/meta";
import type { DadosSemana, TipoPeriodo } from "../relatorio/tipos";
import { rest } from "./supabase";

const GRAPH = "https://graph.facebook.com/v25.0";
const token = () => (process.env.META_ADS_TOKEN ?? process.env.META_ACCESS_TOKEN ?? "").trim();
export const metaLigado = () => Boolean(token());

async function graph<T>(caminho: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token());
  const r = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  const j = (await r.json().catch(() => ({}))) as { error?: { message?: string; code?: number } } & T;
  if (!r.ok || j.error) {
    const msg = j.error?.message ?? `HTTP ${r.status}`;
    // Nunca devolver a URL (ela leva o token).
    throw new Error(j.error?.code === 190 ? "O token do Meta expirou ou foi revogado. Gere outro e atualize META_ADS_TOKEN." : `Meta: ${msg.slice(0, 200)}`);
  }
  return j;
}

/** Contas de anúncio que o token enxerga (para escolher as de cada cliente). */
export async function contasDisponiveis(): Promise<{ id: string; nome: string; ativa: boolean }[]> {
  const contas: { id: string; nome: string; ativa: boolean }[] = [];
  let depois: string | undefined;
  for (let i = 0; i < 5; i++) {
    const j = await graph<{ data: { id: string; name: string; account_status: number }[]; paging?: { cursors?: { after?: string }; next?: string } }>(
      "/me/adaccounts",
      { fields: "name,account_status", limit: "200", ...(depois ? { after: depois } : {}) },
    );
    contas.push(...j.data.map((c) => ({ id: c.id, nome: c.name, ativa: c.account_status === 1 })));
    depois = j.paging?.next ? j.paging.cursors?.after : undefined;
    if (!depois) break;
  }
  return contas.sort((a, b) => Number(b.ativa) - Number(a.ativa) || a.nome.localeCompare(b.nome));
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

async function insights(contas: string[], inicio: string, fim: string) {
  const linhas = await Promise.all(
    contas.map((c) =>
      graph<{ data: InsightMeta[] }>(`/${c}/insights`, {
        level: "account",
        fields: "spend,impressions,clicks,actions,action_values",
        time_range: JSON.stringify({ since: inicio, until: fim }),
      }).then((j) => j.data),
    ),
  );
  return somarInsights(linhas.flat());
}

/** Tráfego do período e do anterior, somando as contas do cliente. Null sem token, sem conta ou se o Meta falhar. */
export async function trafegoDoCliente(cliente: string, tipo: TipoPeriodo, inicio: string, fim: string): Promise<DadosSemana["meta_ads"]> {
  if (!metaLigado()) return null;
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
