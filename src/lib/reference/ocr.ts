// Leitura de texto (OCR) da imagem de referência, no navegador, com tesseract.js.
// O motor e o idioma português são servidos pela própria plataforma (public/ocr, copiados
// por scripts/copy-ocr-assets.mjs). Na primeira vez baixam alguns MB; depois ficam em cache.

import type { TextLine } from "./layout";

export async function readTextLines(
  image: HTMLCanvasElement,
  onProgress?: (status: string, progress: number) => void,
): Promise<TextLine[]> {
  const { createWorker } = await import("tesseract.js");
  const base = `${window.location.origin}/ocr`;
  const worker = await createWorker("por", 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: base,
    langPath: base,
    logger: (message) => onProgress?.(message.status, message.progress),
  });
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true });
    return (data.blocks ?? []).flatMap((block) =>
      block.paragraphs.flatMap((paragraph) =>
        paragraph.lines.map((line) => ({ text: line.text, confidence: line.confidence, ...line.bbox })),
      ),
    );
  } finally {
    await worker.terminate();
  }
}
