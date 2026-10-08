import "server-only";
import { getBrowser } from "./browser";

export interface HtmlPage {
  html: string;
  width: number;
  height: number;
}

const MAX_PARALLEL_PAGES = 4;

/**
 * Renderiza um documento HTML de tamanho fixo em PNG.
 * A página roda sem JavaScript e sem rede: só data URLs são carregadas,
 * então o resultado é determinístico e o HTML não consegue acessar nada externo.
 */
export async function renderHtmlToPng({ html, width, height }: HtmlPage): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().startsWith("data:")) request.continue();
      else request.abort();
    });
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width, height } });
    return Buffer.from(png);
  } finally {
    await page.close();
  }
}

/** Renderiza várias páginas mantendo a ordem, com paralelismo limitado. */
export async function renderPagesToPng(pages: HtmlPage[]): Promise<Buffer[]> {
  const results: Buffer[] = new Array(pages.length);
  let next = 0;
  async function worker() {
    while (next < pages.length) {
      const index = next++;
      results[index] = await renderHtmlToPng(pages[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_PAGES, pages.length) }, worker));
  return results;
}
