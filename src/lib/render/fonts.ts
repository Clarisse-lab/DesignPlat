import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fontFaceCss } from "../templates/fonts";

let cached: string | null = null;

/** CSS de fontes com os arquivos embutidos em base64, para renderizar sem rede. */
export function inlineFontCss(): string {
  if (!cached) {
    const dir = path.join(process.cwd(), "public", "fonts");
    cached = fontFaceCss(
      (file) => `data:font/woff2;base64,${readFileSync(path.join(dir, file)).toString("base64")}`,
    );
  }
  return cached;
}
