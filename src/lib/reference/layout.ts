// Deduz o layout de uma imagem de referência a partir das linhas de texto lidas pelo OCR:
// onde o texto está, como está alinhado e quão grande é o título.

import type { FeedLayout, FeedStyle } from "../templates/feed";

export interface TextLine {
  text: string;
  confidence: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface InferredLayout {
  layout: FeedLayout;
  align: FeedStyle["align"];
  verticalAlign: FeedStyle["verticalAlign"];
  titleScale: number;
}

const BULLET = /^\s*(?:[-•*·–]|\d+[.)])\s+/;
const NUMBER = /^\s*[+\-]?\s*[R$€US]*\s*\d[\d.,]*\s*(%|x|k|mil|mi|bi)?\s*$/i;
const QUOTE = /^\s*[“”"«»]/;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function inferLayout(rawLines: TextLine[], width: number, height: number): InferredLayout | null {
  const lines = rawLines.filter((l) => l.confidence >= 50 && l.text.replace(/[^\p{L}\p{N}]/gu, "").length >= 2);
  if (lines.length === 0) return null;

  const heights = lines.map((l) => l.y1 - l.y0);
  const maxHeight = Math.max(...heights);
  const titleLines = lines.filter((_, i) => heights[i] >= maxHeight * 0.72);
  const bodyLines = lines.filter((l) => !titleLines.includes(l));
  const titleText = titleLines.map((l) => l.text.trim()).join(" ");
  const bodyText = bodyLines.map((l) => l.text.trim()).join(" ");

  // Alinhamento: em texto centralizado os centros das linhas variam menos que as margens esquerdas.
  const lefts = lines.map((l) => l.x0 / width);
  const centers = lines.map((l) => (l.x0 + l.x1) / 2 / width);
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
  const centered =
    lines.length === 1
      ? Math.abs(centers[0] - 0.5) < 0.06 && lefts[0] > 0.12
      : spread(centers) < spread(lefts) * 0.6 && Math.abs(avgCenter - 0.5) < 0.08;

  // Posição vertical do bloco de texto como um todo.
  const top = Math.min(...lines.map((l) => l.y0));
  const bottom = Math.max(...lines.map((l) => l.y1));
  const middle = (top + bottom) / 2 / height;
  const verticalAlign = middle < 0.4 ? "top" : middle > 0.6 ? "bottom" : "center";

  let layout: FeedLayout;
  if (QUOTE.test(titleText)) layout = "citacao";
  else if (NUMBER.test(titleLines[0].text)) layout = "numero";
  else if (bodyLines.filter((l) => BULLET.test(l.text)).length >= 3) layout = "lista";
  else if (bodyText.length < 25) layout = "destaque";
  else layout = "texto";

  // Altura da linha do título em relação à imagem, comparada com a dos nossos layouts.
  const expected = layout === "destaque" ? 0.07 : layout === "numero" ? 0.16 : 0.045;
  const titleScale = Math.round(clamp(maxHeight / height / expected, 0.7, 1.4) * 10) / 10;

  return { layout, align: centered ? "center" : "left", verticalAlign, titleScale };
}
