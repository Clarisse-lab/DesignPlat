// Extrai uma paleta (fundo, texto e destaque) dos pixels de uma imagem de referência.
// Roda no navegador, sem IA: agrupa cores parecidas e escolhe pelas regras abaixo.

import { contrastRatio, contrastText } from "../templates/utils";

export interface ExtractedPalette {
  background: string;
  text: string;
  /** null quando a imagem não tem nenhuma cor viva o bastante para servir de destaque. */
  accent: string | null;
}

interface Bucket {
  count: number;
  border: number;
  r: number;
  g: number;
  b: number;
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const lightness = (max + min) / 2;
  if (max === min) return 0;
  return (max - min) / (1 - Math.abs(2 * lightness - 1));
}

function distance(a: Bucket, b: Bucket): number {
  return Math.hypot(a.r / a.count - b.r / b.count, a.g / a.count - b.g / b.count, a.b / a.count - b.b / b.count);
}

/**
 * - Fundo: a cor mais comum nas bordas da imagem.
 * - Texto: entre as cores frequentes, a de maior contraste com o fundo.
 * - Destaque: a cor mais saturada e presente que não seja o fundo nem o texto.
 */
export function extractPalette(pixels: Uint8ClampedArray, width: number, height: number): ExtractedPalette {
  const buckets = new Map<number, Bucket>();
  const marginX = width * 0.06;
  const marginY = height * 0.06;
  let total = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 128) continue;
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key) ?? { count: 0, border: 0, r: 0, g: 0, b: 0 };
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      if (x < marginX || x > width - marginX || y < marginY || y > height - marginY) bucket.border++;
      buckets.set(key, bucket);
      total++;
    }
  }

  const all = [...buckets.values()];
  if (all.length === 0) return { background: "#FFFFFF", text: "#111111", accent: null };

  const colorOf = (b: Bucket) => toHex(b.r / b.count, b.g / b.count, b.b / b.count);
  const bg = all.reduce((best, b) => (b.border > best.border ? b : best));
  const background = colorOf(bg);

  const frequent = all.filter((b) => b.count >= total * 0.002 && b !== bg);

  const textCandidates = frequent
    .map((b) => ({ b, contrast: contrastRatio(colorOf(b), background) }))
    .filter(({ contrast }) => contrast >= 3)
    .sort((x, y) => y.contrast * Math.log(y.b.count + 1) - x.contrast * Math.log(x.b.count + 1));
  const textBucket = textCandidates[0]?.b;
  const text = textBucket ? colorOf(textBucket) : contrastText(background);

  const accentBucket = frequent
    .filter((b) => distance(b, bg) > 80 && (!textBucket || distance(b, textBucket) > 80))
    .map((b) => ({ b, sat: saturation(b.r / b.count, b.g / b.count, b.b / b.count) }))
    .filter(({ sat }) => sat > 0.3)
    .sort((x, y) => y.sat * Math.sqrt(y.b.count) - x.sat * Math.sqrt(x.b.count))[0]?.b;

  return { background, text, accent: accentBucket ? colorOf(accentBucket) : null };
}
