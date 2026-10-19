import "server-only";
import type { Page } from "puppeteer-core";
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
export async function renderHtmlToPng(input: HtmlPage): Promise<Buffer> {
  return withLoadedPage(input, async (page) => {
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: input.width, height: input.height } });
    return Buffer.from(png);
  });
}

/** Mesmo HTML, impresso em PDF de uma página: textos e formas continuam vetoriais (texto selecionável). */
export async function renderHtmlToPdf(input: HtmlPage): Promise<Buffer> {
  return withLoadedPage(input, async (page) => {
    const pdf = await page.pdf({
      width: `${input.width}px`,
      height: `${input.height}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      pageRanges: "1",
    });
    return Buffer.from(pdf);
  });
}

async function withLoadedPage<T>({ html, width, height }: HtmlPage, run: (page: Page) => Promise<T>): Promise<T> {
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
    return await run(page);
  } finally {
    await page.close();
  }
}

/** Renderiza várias páginas mantendo a ordem, com paralelismo limitado. */
export async function renderPagesToPng(pages: HtmlPage[]): Promise<Buffer[]> {
  return mapLimited(pages, renderHtmlToPng);
}

export async function renderPagesToPdf(pages: HtmlPage[]): Promise<Buffer[]> {
  return mapLimited(pages, renderHtmlToPdf);
}

async function mapLimited(pages: HtmlPage[], render: (page: HtmlPage) => Promise<Buffer>): Promise<Buffer[]> {
  const results: Buffer[] = new Array(pages.length);
  let next = 0;
  async function worker() {
    while (next < pages.length) {
      const index = next++;
      results[index] = await render(pages[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_PAGES, pages.length) }, worker));
  return results;
}
