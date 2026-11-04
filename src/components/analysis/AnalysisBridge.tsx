"use client";

import { useEffect } from "react";
import { loadImageForAnalysis } from "@/lib/client/image";
import { inferLayout, type InferredLayout } from "@/lib/reference/layout";
import { createOcrReader } from "@/lib/reference/ocr";
import { extractPalette, type ExtractedPalette } from "@/lib/reference/palette";

export interface BridgeImage {
  /** Imagem em data URL (o servidor já baixou). */
  src: string;
  /** Rodar OCR para deduzir layout, alinhamento e tamanho do título. */
  ocr: boolean;
}

export interface BridgeResult {
  palette: ExtractedPalette | null;
  layout: InferredLayout | null;
  error: string | null;
}

declare global {
  interface Window {
    __analisarImagens?: (images: BridgeImage[]) => Promise<BridgeResult[]>;
    __analisePronta?: boolean;
  }
}

/** Analisa as imagens uma a uma: paleta sempre; OCR só nas marcadas, com um único motor carregado. */
async function analyze(images: BridgeImage[]): Promise<BridgeResult[]> {
  const reader = images.some((image) => image.ocr) ? await createOcrReader() : null;
  try {
    const results: BridgeResult[] = [];
    for (const image of images) {
      try {
        const blob = await (await fetch(image.src)).blob();
        const small = await loadImageForAnalysis(blob, 220);
        const palette = extractPalette(small.pixels, small.width, small.height);
        let layout: InferredLayout | null = null;
        if (reader && image.ocr) {
          const big = await loadImageForAnalysis(blob, 1600);
          layout = inferLayout(await reader.read(big.canvas), big.width, big.height);
        }
        results.push({ palette, layout, error: null });
      } catch (error) {
        results.push({ palette: null, layout: null, error: String(error) });
      }
    }
    return results;
  } finally {
    await reader?.close();
  }
}

export function AnalysisBridge() {
  useEffect(() => {
    window.__analisarImagens = analyze;
    window.__analisePronta = true;
    return () => {
      delete window.__analisarImagens;
      window.__analisePronta = false;
    };
  }, []);
  return <p className="p-6 text-sm text-ink-soft">Página interna de análise.</p>;
}
