// Leitura de texto (OCR) da imagem de referência, no navegador, com tesseract.js.
// O motor e o idioma português são servidos pela própria plataforma (public/ocr, copiados
// por scripts/copy-ocr-assets.mjs). Na primeira vez baixam alguns MB; depois ficam em cache.

import type { TextLine } from "./layout";

export interface OcrReader {
  read: (image: HTMLCanvasElement) => Promise<TextLine[]>;
  close: () => Promise<void>;
}

/** Abre um leitor de OCR que pode ler várias imagens seguidas (o motor só carrega uma vez). */
export async function createOcrReader(onProgress?: (status: string, progress: number) => void): Promise<OcrReader> {
  const { createWorker } = await import("tesseract.js");
  const base = `${window.location.origin}/ocr`;
  const worker = await createWorker("por", 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: base,
    langPath: base,
    logger: (message) => onProgress?.(message.status, message.progress),
  });
  return {
    async read(image) {
      const { data } = await worker.recognize(image, {}, { blocks: true });
      return (data.blocks ?? []).flatMap((block) =>
        block.paragraphs.flatMap((paragraph) =>
          paragraph.lines.map((line) => ({ text: line.text, confidence: line.confidence, ...line.bbox })),
        ),
      );
    },
    async close() {
      await worker.terminate();
    },
  };
}

export async function readTextLines(
  image: HTMLCanvasElement,
  onProgress?: (status: string, progress: number) => void,
): Promise<TextLine[]> {
  const reader = await createOcrReader(onProgress);
  try {
    return await reader.read(image);
  } finally {
    await reader.close();
  }
}
