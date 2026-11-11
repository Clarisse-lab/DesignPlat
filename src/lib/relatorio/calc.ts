// Contas do relatório semanal, sem acesso a banco (testáveis): semanas, escolha da coleta, somas e comparação.
// Semana = segunda a domingo, no horário de Brasília (UTC-3, sem horário de verão desde 2019).

import type { Kpi, PostSemana } from "./tipos";

const DIA = 86_400_000;
const OFFSET = -3 * 3600_000;

/** "2026-11-02" a partir de um instante, no fuso de Brasília. */
export function dataBrasilia(at: Date): string {
  return new Date(at.getTime() + OFFSET).toISOString().slice(0, 10);
}

export function somaDias(data: string, dias: number): string {
  return new Date(Date.parse(`${data}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
}

/** Segunda-feira da semana de uma data (YYYY-MM-DD). */
export function segunda(data: string): string {
  const dow = new Date(`${data}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return somaDias(data, dow === 0 ? -6 : 1 - dow);
}

/** Última semana completa (segunda a domingo) antes de `agora`. */
export function ultimaSemanaCompleta(agora: Date = new Date()): { inicio: string; fim: string } {
  const inicio = somaDias(segunda(dataBrasilia(agora)), -7);
  return { inicio, fim: somaDias(inicio, 6) };
}

/** Semanas completas mais recentes (a primeira é a última completa). */
export function semanasRecentes(qtd: number, agora: Date = new Date()): { inicio: string; fim: string }[] {
  const { inicio } = ultimaSemanaCompleta(agora);
  return Array.from({ length: qtd }, (_, i) => {
    const ini = somaDias(inicio, -7 * i);
    return { inicio: ini, fim: somaDias(ini, 6) };
  });
}

/** Intervalo da semana em instantes UTC: [início, fim) cobrindo segunda 00h até a segunda seguinte 00h (Brasília). */
export function intervaloUtc(inicio: string): { de: string; ate: string } {
  const de = new Date(Date.parse(`${inicio}T00:00:00Z`) - OFFSET).toISOString();
  const ate = new Date(Date.parse(`${somaDias(inicio, 7)}T00:00:00Z`) - OFFSET).toISOString();
  return { de, ate };
}

/**
 * Data de coleta usada para medir os posts de uma semana: a primeira coleta depois do domingo
 * (as coletas são semanais, às segundas). Sem coleta depois, usa a mais recente (relatório parcial).
 */
export function coletaDaSemana(fim: string, coletas: string[]): { data: string | null; parcial: boolean } {
  const ordenadas = [...new Set(coletas)].sort();
  const depois = ordenadas.find((d) => d > fim);
  if (depois) return { data: depois, parcial: false };
  return { data: ordenadas.at(-1) ?? null, parcial: true };
}

/** Seguidores numa data: o ponto mais recente até `data` (+1 dia de folga), somando as contas. */
export function seguidoresEm(pontos: { conta: string; data: string; seguidores: number }[], data: string): number | null {
  const limite = somaDias(data, 1);
  const porConta = new Map<string, { data: string; seguidores: number }>();
  for (const p of pontos) {
    if (p.data > limite) continue;
    const atual = porConta.get(p.conta);
    if (!atual || p.data > atual.data) porConta.set(p.conta, { data: p.data, seguidores: p.seguidores });
  }
  if (!porConta.size) return null;
  return [...porConta.values()].reduce((s, p) => s + p.seguidores, 0);
}

/** Novos seguidores numa semana: diferença entre as coletas da segunda seguinte e da segunda da semana. */
export function novosSeguidores(pontos: { conta: string; data: string; seguidores: number }[], inicio: string, fim: string): number | null {
  const contas = new Set(pontos.map((p) => p.conta));
  const final = seguidoresEm(pontos, somaDias(fim, 1));
  const inicial = seguidoresEm(pontos, inicio);
  if (final === null || inicial === null) return null;
  // Só vale se as duas pontas vierem de coletas diferentes (senão a diferença é zero por falta de dado).
  const datas = (limite: string) =>
    [...contas].map((c) => pontos.filter((p) => p.conta === c && p.data <= somaDias(limite, 1)).map((p) => p.data).sort().at(-1) ?? "").join();
  if (datas(somaDias(fim, 1)) === datas(inicio)) return null;
  return final - inicial;
}

export function formato(tipo: string, produto: string | null): PostSemana["formato"] {
  if (produto === "REELS") return "Reels";
  if (tipo === "CAROUSEL_ALBUM") return "Carrossel";
  if (tipo === "VIDEO") return "Vídeo";
  return "Foto";
}

const soma = (lista: PostSemana[], campo: keyof Pick<PostSemana, "alcance" | "interacoes" | "salvamentos" | "compartilhamentos" | "visualizacoes">) => {
  const valores = lista.map((p) => p[campo]).filter((v): v is number => typeof v === "number");
  return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
};

export function totais(lista: PostSemana[]) {
  const salvos = soma(lista, "salvamentos");
  const compart = soma(lista, "compartilhamentos");
  return {
    posts: lista.length,
    alcance: soma(lista, "alcance"),
    interacoes: soma(lista, "interacoes"),
    visualizacoes: soma(lista, "visualizacoes"),
    salvos_compart: salvos === null && compart === null ? null : (salvos ?? 0) + (compart ?? 0),
  };
}

/** Nota de conteúdo: salvamentos + compartilhamentos por mil de alcance (a mesma da aba Desempenho). */
export function nota(p: Pick<PostSemana, "alcance" | "salvamentos" | "compartilhamentos">): number {
  if (!p.alcance || p.alcance < 50) return 0;
  return (((p.salvamentos ?? 0) + (p.compartilhamentos ?? 0)) * 1000) / p.alcance;
}

/** Os 3 melhores posts: metade do peso no alcance, metade na nota (o que foi visto e o que foi guardado). */
export function melhores(lista: PostSemana[], qtd = 3): string[] {
  if (!lista.length) return [];
  const maxAlcance = Math.max(1, ...lista.map((p) => p.alcance ?? 0));
  const maxNota = Math.max(1e-9, ...lista.map(nota));
  return [...lista]
    .map((p) => ({ id: p.media_id, score: (p.alcance ?? 0) / maxAlcance + nota(p) / maxNota }))
    .sort((a, b) => b.score - a.score)
    .slice(0, qtd)
    .map((x) => x.id);
}

export function porFormato(lista: PostSemana[]) {
  const mapa = new Map<string, { formato: string; posts: number; alcance: number }>();
  for (const p of lista) {
    const atual = mapa.get(p.formato) ?? { formato: p.formato, posts: 0, alcance: 0 };
    atual.posts++;
    atual.alcance += p.alcance ?? 0;
    mapa.set(p.formato, atual);
  }
  return [...mapa.values()].sort((a, b) => b.alcance - a.alcance);
}

export const kpi = (valor: number | null, anterior: number | null): Kpi => ({ valor, anterior });

/** Variação em % (null quando não dá para comparar). */
export function variacao(k: Kpi): number | null {
  if (k.valor === null || k.anterior === null || k.anterior === 0) return null;
  return Math.round(((k.valor - k.anterior) / Math.abs(k.anterior)) * 1000) / 10;
}
