// Fontes usadas pelos templates. Os arquivos ficam em public/fonts.
// O preview (navegador) aponta para /fonts/...; o renderizador (servidor)
// embute os arquivos em base64 para não depender de rede.

const LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT_RANGE =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

export const FONT_FILES = [
  { file: "inter-latin-400-normal.woff2", family: "Inter", weight: 400, range: LATIN_RANGE },
  { file: "inter-latin-700-normal.woff2", family: "Inter", weight: 700, range: LATIN_RANGE },
  { file: "inter-latin-ext-400-normal.woff2", family: "Inter", weight: 400, range: LATIN_EXT_RANGE },
  { file: "inter-latin-ext-700-normal.woff2", family: "Inter", weight: 700, range: LATIN_EXT_RANGE },
] as const;

export function fontFaceCss(resolveUrl: (file: string) => string): string {
  return FONT_FILES.map(
    (f) =>
      `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:block;` +
      `src:url("${resolveUrl(f.file)}") format("woff2");unicode-range:${f.range};}`,
  ).join("\n");
}

/** CSS de fontes para uso no navegador (preview). */
export const browserFontCss = fontFaceCss((file) => `/fonts/${file}`);
