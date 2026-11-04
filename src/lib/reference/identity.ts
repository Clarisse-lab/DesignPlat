import "server-only";
// Leitura da identidade visual de vários posts, no servidor.
// Baixa as imagens do Instagram (só dos domínios da Meta), abre a página interna /interno/analise
// no Chromium e roda nela o mesmo código do "Inspirar" do editor (paleta + OCR). Sem IA.

import type { BridgeImage, BridgeResult } from "@/components/analysis/AnalysisBridge";
import { getBrowser } from "../render/browser";

const MAX_IMAGE_BYTES = 10_000_000;
const ANALYSIS_TIMEOUT_MS = 240_000;

/** Só aceita imagens servidas pela Meta (Instagram/Facebook), por HTTPS. */
export function isMetaImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host.endsWith(".cdninstagram.com") || host.endsWith(".fbcdn.net"));
  } catch {
    return false;
  }
}

export async function downloadImageAsDataUrl(url: string): Promise<string> {
  if (!isMetaImageUrl(url)) throw new Error("endereço de imagem não permitido");
  const response = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000) });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("image/")) throw new Error(`resposta ${response.status} ${type}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("imagem grande demais");
  return `data:${type.split(";")[0]};base64,${bytes.toString("base64")}`;
}

/** Roda a análise na página interna, dentro do Chromium do servidor. */
export async function analyzeImages(images: BridgeImage[]): Promise<BridgeResult[]> {
  if (images.length === 0) return [];
  const port = process.env.PORT ?? "3000";
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    page.setDefaultTimeout(ANALYSIS_TIMEOUT_MS);
    await page.goto(`http://127.0.0.1:${port}/interno/analise`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForFunction(() => window.__analisePronta === true, { timeout: 30_000 });
    return await page.evaluate((list: BridgeImage[]) => window.__analisarImagens!(list), images);
  } finally {
    await page.close();
  }
}
