// Template do "Post de Feed": posts e carrosséis de Instagram com identidade da marca.
// Cada slide escolhe um layout; cores, fonte e marca valem para todos.

import { CANVAS_SIZES, type FeedCanvasSizeId } from "../formats";
import { contrastText, escapeHtml, formatRichText, htmlDocument, initials, safeColor, safeImageSrc, sizeByLength } from "./utils";

export const FEED_LAYOUTS = ["destaque", "texto", "citacao", "foto"] as const;
export type FeedLayout = (typeof FEED_LAYOUTS)[number];

export const FEED_LAYOUT_LABELS: Record<FeedLayout, string> = {
  destaque: "Destaque",
  texto: "Texto",
  citacao: "Citação",
  foto: "Foto",
};

export interface FeedSlide {
  layout: FeedLayout;
  /** Título (no layout Citação, é a própria frase). */
  title: string;
  /** Texto de apoio (no layout Citação, é o autor). */
  body: string;
  /** Data URL da imagem: fundo no Destaque, foto no layout Foto. */
  image?: string | null;
}

export interface FeedBrand {
  name: string;
  handle: string;
  /** Data URL do logo ou foto da marca. Sem ele, usa as iniciais. */
  logo?: string | null;
}

export interface FeedPalette {
  background: string;
  text: string;
  accent: string;
}

export interface FeedStyle {
  size: FeedCanvasSizeId;
  palette: FeedPalette;
  titleFont: "sans" | "serif";
  showPageNumber: boolean;
}

export const FEED_PALETTES: { name: string; palette: FeedPalette }[] = [
  { name: "Clássico", palette: { background: "#FFFFFF", text: "#16161A", accent: "#4F46E5" } },
  { name: "Creme", palette: { background: "#F4EDE4", text: "#2B2118", accent: "#C2410C" } },
  { name: "Noite", palette: { background: "#0F1115", text: "#F2F2F0", accent: "#A3E635" } },
  { name: "Oceano", palette: { background: "#EEF4F8", text: "#0B2533", accent: "#0E7490" } },
  { name: "Rosa", palette: { background: "#FFF1F4", text: "#3A0F1C", accent: "#DB2777" } },
];

const FONT_STACKS = {
  sans: '"Inter", Arial, sans-serif',
  serif: '"Playfair Display", Georgia, serif',
};

function footer(brand: FeedBrand, pageLabel: string | null, color: string): string {
  const logoSrc = safeImageSrc(brand.logo);
  const handle = brand.handle.trim().replace(/^@+/, "");
  const logo = logoSrc
    ? `<img class="logo" src="${logoSrc}" alt=""/>`
    : `<div class="logo initials">${escapeHtml(initials(brand.name))}</div>`;
  return `<div class="footer" style="color:${color}">
    <div class="brand">${logo}<span>${escapeHtml(handle ? `@${handle}` : brand.name.trim())}</span></div>
    ${pageLabel ? `<span class="page">${pageLabel}</span>` : ""}
  </div>`;
}

export function renderFeedSlide(params: {
  slide: FeedSlide;
  brand: FeedBrand;
  style: FeedStyle;
  index: number;
  total: number;
  fontCss: string;
}): string {
  const { slide, brand, style, index, total, fontCss } = params;
  const { width, height } = CANVAS_SIZES[style.size];

  const bg = safeColor(style.palette.background, "#FFFFFF");
  const text = safeColor(style.palette.text, "#16161A");
  const accent = safeColor(style.palette.accent, "#4F46E5");
  const onAccent = contrastText(accent);
  const titleFont = FONT_STACKS[style.titleFont];
  const imageSrc = safeImageSrc(slide.image);
  const pageLabel = style.showPageNumber && total > 1 ? `${index + 1}/${total}` : null;

  const title = formatRichText(slide.title);
  const body = formatRichText(slide.body);

  let pageBg = bg;
  let pageColor = text;
  let content = "";

  switch (slide.layout) {
    case "destaque": {
      const titleSize = sizeByLength(slide.title, [[30, 112], [60, 96], [110, 80], [180, 66]], 56);
      if (imageSrc) {
        pageBg = "#000000";
        pageColor = "#FFFFFF";
      } else {
        pageBg = accent;
        pageColor = onAccent;
      }
      content = `
        ${imageSrc ? `<img class="cover-img" src="${imageSrc}" alt=""/><div class="cover-shade"></div>` : ""}
        <div class="main destaque">
          <h1 style="font-size:${titleSize}px">${title}</h1>
          ${slide.body.trim() ? `<p class="lead">${body}</p>` : ""}
        </div>`;
      break;
    }
    case "texto": {
      const titleSize = sizeByLength(slide.title, [[40, 72], [80, 60], [140, 52]], 46);
      const bodySize = sizeByLength(slide.body, [[160, 42], [300, 37], [480, 33]], 29);
      content = `
        <div class="main texto">
          <div class="bar"></div>
          ${slide.title.trim() ? `<h2 style="font-size:${titleSize}px">${title}</h2>` : ""}
          ${slide.body.trim() ? `<p class="body" style="font-size:${bodySize}px">${body}</p>` : ""}
        </div>`;
      break;
    }
    case "citacao": {
      const quoteSize = sizeByLength(slide.title, [[60, 76], [120, 64], [200, 54]], 46);
      content = `
        <div class="main citacao">
          <div class="quote-mark">“</div>
          <blockquote style="font-size:${quoteSize}px">${title}</blockquote>
          ${slide.body.trim() ? `<p class="author">— ${body}</p>` : ""}
        </div>`;
      break;
    }
    case "foto": {
      const titleSize = sizeByLength(slide.title, [[40, 60], [90, 52]], 44);
      const bodySize = sizeByLength(slide.body, [[140, 34], [260, 30]], 27);
      content = `
        <div class="photo">${imageSrc ? `<img src="${imageSrc}" alt=""/>` : ""}</div>
        <div class="main foto">
          ${slide.title.trim() ? `<h2 style="font-size:${titleSize}px">${title}</h2>` : ""}
          ${slide.body.trim() ? `<p class="body" style="font-size:${bodySize}px">${body}</p>` : ""}
        </div>`;
      break;
    }
  }

  const css = `
body{background:${pageBg};color:${pageColor};font-family:"Inter",Arial,sans-serif}
.page-wrap{position:relative;width:${width}px;height:${height}px;padding:88px 92px 72px;display:flex;flex-direction:column;overflow:hidden}
.main{position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0}
h1,h2,blockquote{font-family:${titleFont};font-weight:700;line-height:1.08;letter-spacing:-0.02em;overflow-wrap:break-word}
strong{font-weight:700}
.lead{margin-top:40px;font-size:38px;line-height:1.4;opacity:.88;max-width:860px}
.cover-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cover-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.2) 0%,rgba(0,0,0,.55) 45%,rgba(0,0,0,.9) 100%)}
.destaque{justify-content:${imageSrc ? "flex-end" : "center"}}
.texto .bar{width:96px;height:12px;border-radius:6px;background:${accent};margin-bottom:48px}
.texto h2{margin-bottom:40px}
.body{line-height:1.45;overflow-wrap:break-word}
.texto .body strong,.foto .body strong{color:${accent}}
.quote-mark{font-family:"Playfair Display",Georgia,serif;font-size:260px;line-height:.8;height:150px;color:${accent}}
.citacao blockquote{margin-top:24px}
.author{margin-top:48px;font-size:34px;opacity:.7}
.photo{position:relative;margin:-88px -92px 56px;height:${Math.round(height * 0.56)}px;background:${accent};flex-shrink:0}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.foto{justify-content:flex-start}
.foto h2{margin-bottom:24px}
.footer{position:relative;display:flex;align-items:center;justify-content:space-between;margin-top:40px;font-size:28px;font-weight:700;flex-shrink:0}
.brand{display:flex;align-items:center;gap:16px}
.logo{width:56px;height:56px;border-radius:50%;object-fit:cover}
.initials{display:flex;align-items:center;justify-content:center;font-size:22px;background:${accent};color:${onAccent}}
.page{opacity:.6;font-weight:400}
`;

  // No Destaque sem imagem o fundo é a cor de destaque; as iniciais ganham contraste invertido.
  const initialsFix =
    slide.layout === "destaque" && !imageSrc ? `.initials{background:${onAccent};color:${accent}}` : "";

  const bodyHtml = `<div class="page-wrap">${content}${footer(brand, pageLabel, pageColor)}</div>`;
  return htmlDocument({ width, height, fontCss, css: css + initialsFix, body: bodyHtml });
}

/**
 * Transforma um texto corrido em slides: cada bloco separado por linha em branco
 * vira um slide; a primeira linha do bloco é o título e o resto é o texto.
 * Uma linha com apenas "---" também separa slides (útil para blocos com parágrafos).
 */
export function splitContentIntoSlides(content: string): FeedSlide[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const blocks = /^\s*---\s*$/m.test(normalized)
    ? normalized.split(/^\s*---\s*$/m)
    : normalized.split(/\n\s*\n/);

  return blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, i) => {
      const [first, ...rest] = block.split("\n");
      return {
        layout: i === 0 ? "destaque" : "texto",
        title: first.replace(/^#+\s*/, "").trim(),
        body: rest.join("\n").trim(),
        image: null,
      } satisfies FeedSlide;
    });
}
