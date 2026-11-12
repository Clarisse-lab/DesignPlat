// Tráfego pago a partir do Meta Ads: soma os insights das contas de anúncio do cliente e
// junta com o que a equipe digitou (o que foi digitado vale mais que o número do Meta).
// Funções puras, para dar para testar com respostas de exemplo da API.

import type { DadosSemana, MetaNumeros, TrafegoSemana } from "./tipos";

interface Acao {
  action_type: string;
  value: string;
}
export interface InsightMeta {
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: Acao[];
  action_values?: Acao[];
}

const num = (v: string | undefined) => (v ? Number(v) || 0 : 0);
/** Primeiro tipo de ação que existir na lista (o Meta repete a mesma conversão com nomes diferentes). */
function acao(lista: Acao[] | undefined, tipos: string[]): number {
  for (const t of tipos) {
    const a = (lista ?? []).find((x) => x.action_type === t);
    if (a) return Number(a.value) || 0;
  }
  return 0;
}

const LEAD = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];
const COMPRA = ["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"];

/** Soma as linhas de insights (uma por conta) num só conjunto de números. */
export function somarInsights(linhas: InsightMeta[]): MetaNumeros {
  const n: MetaNumeros = { investimento: 0, impressoes: 0, cliques: 0, leads: 0, vendas: 0, faturamento: 0, visualizacoes: 0, conversas: 0 };
  for (const l of linhas) {
    n.investimento += num(l.spend);
    n.impressoes += num(l.impressions);
    n.cliques += num(l.clicks);
    n.leads += acao(l.actions, LEAD);
    n.vendas += acao(l.actions, COMPRA);
    n.faturamento += acao(l.action_values, COMPRA);
    n.visualizacoes += acao(l.actions, ["video_view"]);
    n.conversas = (n.conversas ?? 0) + acao(l.actions, ["onsite_conversion.messaging_conversation_started_7d"]);
  }
  n.investimento = Math.round(n.investimento * 100) / 100;
  n.faturamento = Math.round(n.faturamento * 100) / 100;
  return n;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Os números do Meta no formato do relatório, com as taxas calculadas. Zero de leads ou vendas não aparece. */
export function trafegoDoMeta(n: MetaNumeros): TrafegoSemana {
  if (n.investimento <= 0 && n.impressoes <= 0) return {};
  return {
    investimento: n.investimento,
    impressoes: n.impressoes || null,
    cliques: n.cliques || null,
    ctr: n.impressoes > 0 ? r2((n.cliques / n.impressoes) * 100) : null,
    cpc: n.cliques > 0 ? r2(n.investimento / n.cliques) : null,
    cpm: n.impressoes > 0 ? r2((n.investimento / n.impressoes) * 1000) : null,
    cpv: n.visualizacoes > 0 ? Math.round((n.investimento / n.visualizacoes) * 1000) / 1000 : null,
    leads: n.leads || null,
    vendas: n.vendas || null,
    faturamento: n.faturamento || null,
    conversas: n.conversas || null,
  };
}

const CAMPOS: (keyof TrafegoSemana)[] = ["investimento", "leads", "cpl", "vendas", "faturamento", "roas", "impressoes", "cliques", "ctr", "cpc", "cpm", "cpv", "conversas"];
const preenchido = (v: unknown) => v !== null && v !== undefined && v !== "";

/**
 * O tráfego que o cliente vê: os números do Meta, com o que a equipe digitou por cima.
 * Custo por lead e ROAS são recalculados quando a equipe muda leads, vendas ou faturamento e não digitou a taxa.
 */
export function trafegoEfetivo(dados: Pick<DadosSemana, "meta_ads">, manual: TrafegoSemana | null | undefined): TrafegoSemana {
  const m = manual ?? {};
  const meta = dados.meta_ads ? trafegoDoMeta(dados.meta_ads.atual) : {};
  if (!Object.keys(meta).length) return m;
  const t: TrafegoSemana = { ...meta };
  for (const k of CAMPOS) if (preenchido(m[k])) (t as Record<string, unknown>)[k] = m[k];
  if (preenchido(m.observacao)) t.observacao = m.observacao;
  const inv = t.investimento ?? 0;
  if (!preenchido(m.cpl)) t.cpl = t.leads && inv > 0 ? r2(inv / t.leads) : null;
  if (!preenchido(m.roas)) t.roas = t.faturamento && inv > 0 ? r2(t.faturamento / inv) : null;
  return t;
}

/** Valor do período anterior no Meta, para a comparação, quando o número mostrado é o do Meta (não foi digitado). */
export function anteriorDoMeta(dados: Pick<DadosSemana, "meta_ads">, manual: TrafegoSemana | null | undefined, campo: keyof TrafegoSemana): number | null {
  if (!dados.meta_ads?.anterior || preenchido(manual?.[campo])) return null;
  const v = trafegoEfetivo({ meta_ads: { ...dados.meta_ads, atual: dados.meta_ads.anterior } }, {})[campo];
  return typeof v === "number" ? v : null;
}

/** O tráfego para a apresentação: o efetivo e o anterior de cada número que veio do Meta. */
export function trafegoParaView(dados: Pick<DadosSemana, "meta_ads">, manual: TrafegoSemana | null | undefined) {
  const anterior: Partial<Record<keyof TrafegoSemana, number | null>> = {};
  for (const k of CAMPOS) anterior[k] = anteriorDoMeta(dados, manual, k);
  return { trafego: trafegoEfetivo(dados, manual), trafego_anterior: anterior };
}
