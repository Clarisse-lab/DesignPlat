// Copia o motor de OCR (tesseract.js) e o idioma português para public/ocr,
// para o navegador carregar tudo da própria plataforma, sem depender de CDN.
// Roda automaticamente antes de `npm run dev` e `npm run build`.

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const target = join(process.cwd(), "public", "ocr");
mkdirSync(target, { recursive: true });

const tesseractDist = join(dirname(require.resolve("tesseract.js/package.json")), "dist");
const coreDir = dirname(require.resolve("tesseract.js-core/package.json"));
const porDir = dirname(require.resolve("@tesseract.js-data/por/package.json"));

const files = [
  [join(tesseractDist, "worker.min.js"), "worker.min.js"],
  // Só o modo LSTM é usado; o tesseract.js escolhe a variante conforme o suporte do navegador.
  [join(coreDir, "tesseract-core-lstm.wasm.js"), "tesseract-core-lstm.wasm.js"],
  [join(coreDir, "tesseract-core-simd-lstm.wasm.js"), "tesseract-core-simd-lstm.wasm.js"],
  [join(coreDir, "tesseract-core-relaxedsimd-lstm.wasm.js"), "tesseract-core-relaxedsimd-lstm.wasm.js"],
  [join(porDir, "4.0.0_best_int", "por.traineddata.gz"), "por.traineddata.gz"],
];

for (const [from, name] of files) {
  if (!existsSync(from)) throw new Error(`Arquivo de OCR não encontrado: ${from}`);
  copyFileSync(from, join(target, name));
}
console.log(`OCR: ${files.length} arquivos copiados para public/ocr`);
