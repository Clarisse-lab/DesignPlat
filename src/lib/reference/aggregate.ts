// Junta as leituras de vários posts (paleta e layout de cada imagem) numa identidade só:
// o kit de marca sugerido. Puro e sem IA: votação ponderada pela nota de cada post
// (posts que mais salvaram e compartilharam pesam mais).

import type { FeedLayout, FeedPalette, FeedStyle } from "../templates/feed";
import type { InferredLayout } from "./layout";
import type { ExtractedPalette } from "./palette";

export interface Reading {
  /** Peso do post (nota de desempenho). Sem nota, vale 1. */
  weight: number;
  palette: ExtractedPalette;
  layout: InferredLayout | null;
  /** Capa do carrossel ou post único; "interna" é uma tela de dentro do carrossel. */
  slot: "capa" | "interna";
}

export interface SuggestedKit {
  palette: FeedPalette;
  align: FeedStyle["align"];
  verticalAlign: FeedStyle["verticalAlign"];
  titleScale: number;
  coverBackground: FeedStyle["coverBackground"];
  /** Layouts mais usados, do mais para o menos frequente. */
  layouts: FeedLayout[];
  /** Outras paletas recorrentes (ex.: a versão escura usada em parte dos posts). */
  alternatives: FeedPalette[];
  /** De 0 a 1: quanto os posts concordam entre si. Abaixo de 0,5 vale revisar com atenção. */
  confidence: number;
}

/** Peso mínimo para um post sem nota (ou nota 0) ainda contar. */
const BASE_WEIGHT = 1;
/** Distância RGB abaixo da qual duas cores contam como a mesma. */
const SAME_COLOR = 48;

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

interface Cluster<T> {
  key: string;
  weight: number;
  items: T[];
}

/** Agrupa cores parecidas; cada grupo é representado pela cor de maior peso. */
function clusterColors<T>(entries: { color: string; weight: number; item: T }[]): Cluster<T>[] {
  const clusters: Cluster<T>[] = [];
  for (const entry of [...entries].sort((a, b) => b.weight - a.weight)) {
    const found = clusters.find((c) => colorDistance(c.key, entry.color) < SAME_COLOR);
    if (found) {
      found.weight += entry.weight;
      found.items.push(entry.item);
    } else {
      clusters.push({ key: entry.color, weight: entry.weight, items: [entry.item] });
    }
  }
  return clusters.sort((a, b) => b.weight - a.weight);
}

function weightedMode<T extends string>(values: { value: T; weight: number }[], fallback: T): T {
  const totals = new Map<T, number>();
  for (const { value, weight } of values) totals.set(value, (totals.get(value) ?? 0) + weight);
  let best = fallback;
  let bestWeight = -1;
  for (const [value, weight] of totals) {
    if (weight > bestWeight) {
      best = value;
      bestWeight = weight;
    }
  }
  return best;
}

function weightedMedian(values: { value: number; weight: number }[], fallback: number): number {
  if (values.length === 0) return fallback;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const half = sorted.reduce((sum, v) => sum + v.weight, 0) / 2;
  let acc = 0;
  for (const v of sorted) {
    acc += v.weight;
    if (acc >= half) return v.value;
  }
  return sorted[sorted.length - 1].value;
}

function paletteOf(cluster: Cluster<Reading>): FeedPalette {
  const weighted = (pick: (r: Reading) => string | null) =>
    clusterColors(
      cluster.items
        .map((r) => ({ color: pick(r), weight: r.weight, item: r }))
        .filter((e): e is { color: string; weight: number; item: Reading } => e.color !== null),
    )[0]?.key ?? null;
  const text = weighted((r) => r.palette.text) ?? "#111111";
  const accent = weighted((r) => r.palette.accent) ?? text;
  return { background: cluster.key, text, accent };
}

export function aggregateReadings(input: Reading[]): SuggestedKit | null {
  const readings = input.map((r) => ({ ...r, weight: Math.max(BASE_WEIGHT, r.weight || 0) }));
  if (readings.length === 0) return null;
  const totalWeight = readings.reduce((sum, r) => sum + r.weight, 0);

  // Paleta: o fundo mais recorrente define o grupo; texto e destaque vêm dos posts desse grupo.
  const backgrounds = clusterColors(readings.map((r) => ({ color: r.palette.background, weight: r.weight, item: r })));
  const main = backgrounds[0];
  const palette = paletteOf(main);
  const alternatives = backgrounds
    .slice(1)
    .filter((c) => c.weight >= totalWeight * 0.15)
    .slice(0, 2)
    .map(paletteOf);

  // Capa com fundo na cor de destaque? Compara o fundo das capas com o destaque da paleta principal.
  const covers = readings.filter((r) => r.slot === "capa");
  const coverOnAccent = covers.filter((r) => colorDistance(r.palette.background, palette.accent) < SAME_COLOR);
  const coverWeight = covers.reduce((sum, r) => sum + r.weight, 0);
  const coverOnAccentWeight = coverOnAccent.reduce((sum, r) => sum + r.weight, 0);
  const coverBackground: FeedStyle["coverBackground"] =
    coverWeight > 0 && coverOnAccentWeight / coverWeight >= 0.4 ? "accent" : "background";

  // Layout: só as imagens em que o OCR achou texto.
  const withText = readings.filter((r): r is Reading & { layout: InferredLayout } => r.layout !== null);
  const align = weightedMode(withText.map((r) => ({ value: r.layout.align, weight: r.weight })), "left");
  const verticalAlign = weightedMode(withText.map((r) => ({ value: r.layout.verticalAlign, weight: r.weight })), "center");
  const titleScale = weightedMedian(withText.map((r) => ({ value: r.layout.titleScale, weight: r.weight })), 1);

  const layoutTotals = new Map<FeedLayout, number>();
  for (const r of withText) layoutTotals.set(r.layout.layout, (layoutTotals.get(r.layout.layout) ?? 0) + r.weight);
  const layouts = [...layoutTotals.entries()].sort((a, b) => b[1] - a[1]).map(([layout]) => layout);

  // Confiança: quanto do peso está no fundo principal e, se houver texto lido, no alinhamento vencedor.
  const backgroundShare = main.weight / totalWeight;
  const alignShare = withText.length
    ? withText.filter((r) => r.layout.align === align).reduce((sum, r) => sum + r.weight, 0) /
      withText.reduce((sum, r) => sum + r.weight, 0)
    : backgroundShare;
  const confidence = Math.round(((backgroundShare + alignShare) / 2) * 100) / 100;

  return { palette, align, verticalAlign, titleScale, coverBackground, layouts, alternatives, confidence };
}
