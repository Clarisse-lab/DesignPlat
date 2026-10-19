// Template do "Post de Feed": posts e carrosséis de Instagram com identidade da marca.
// O mesmo template serve ao Story (9:16) e à Apresentação (16:9).
// Cada slide escolhe um layout; cores, fonte, alinhamento e decoração valem para todos.

import { CANVAS_SIZES, type PostCanvasSizeId } from "../formats";
import { TITLE_FONTS, type TitleFontId } from "./fonts";
import { iconSvg, markSvg } from "./icons";
import { sanitizeLayoutCss, sanitizeLayoutHtml } from "./sanitize";
import { contrastText, escapeHtml, formatRichText, htmlDocument, initials, safeColor, safeImageSrc, sizeByLength } from "./utils";

export const FEED_LAYOUTS = [
  "destaque",
  "texto",
  "lista",
  "numero",
  "citacao",
  "comparacao",
  "foto",
  "celular",
  "sticker",
  "cta",
  "secao",
  "colunas",
  "referencia",
] as const;
export type FeedLayout = (typeof FEED_LAYOUTS)[number];

export const FEED_LAYOUT_LABELS: Record<FeedLayout, string> = {
  destaque: "Destaque",
  texto: "Texto",
  lista: "Lista",
  numero: "Número",
  citacao: "Citação",
  comparacao: "Antes × Depois",
  foto: "Foto",
  celular: "Celular",
  sticker: "Enquete / Pergunta",
  cta: "Chamada (link)",
  secao: "Seção",
  colunas: "Colunas",
  referencia: "Da referência",
};

/** Layouts pensados para Story (aparecem só no editor de Story). */
export const STORY_ONLY_LAYOUTS: readonly FeedLayout[] = ["sticker", "cta"];

/** Layouts pensados para Apresentação (aparecem só no editor de Apresentação). */
export const PRESENTATION_ONLY_LAYOUTS: readonly FeedLayout[] = ["secao", "colunas"];

/** Número da seção de um slide "Seção": quantos slides desse layout existem até ele (inclusive). */
export function sectionNumberAt(slides: readonly Pick<FeedSlide, "layout">[], index: number): number {
  return slides.slice(0, index + 1).filter((slide) => slide.layout === "secao").length;
}

/** Blocos separados por linha em branco; a primeira linha de cada bloco é o rótulo. */
export function columnBlocks(body: string): { label: string; text: string }[] {
  return body
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const [label, ...rest] = block.split("\n");
      return { label: label.trim(), text: rest.join("\n").trim() };
    });
}

/**
 * Áreas do Story cobertas pela interface do Instagram, em % da altura:
 * no topo a barra de progresso e o perfil, na base o campo de resposta.
 */
export const STORY_SAFE_ZONES = { topPercent: 13, bottomPercent: 17 } as const;

/** Espaço deixado livre no layout Enquete / Pergunta para colar o sticker no Instagram, em % da altura. */
export const STICKER_SLOT = { topPercent: 52, heightPercent: 23 } as const;

export const FEED_DECORS = ["nenhum", "formas", "pontos", "degrade", "moldura"] as const;
export type FeedDecor = (typeof FEED_DECORS)[number];

export const FEED_DECOR_LABELS: Record<FeedDecor, string> = {
  nenhum: "Nenhuma",
  formas: "Formas",
  pontos: "Pontos",
  degrade: "Degradê",
  moldura: "Moldura",
};

export interface FeedSlide {
  layout: FeedLayout;
  /** Título (Citação: a frase; Número: o número em destaque). */
  title: string;
  /** Texto de apoio (Citação: o autor; Lista: um item por linha; Antes × Depois: duas colunas separadas por linha em branco). */
  body: string;
  /** Data URL da imagem: fundo no Destaque, foto no layout Foto, tela no Celular. */
  image?: string | null;
  /** Ícone opcional (ver icons.ts). */
  icon?: string | null;
  /** Notas do apresentador (só Apresentação; não aparecem na imagem, vão para o PPTX). */
  notes?: string | null;
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

/** Layout criado a partir de uma imagem de referência (HTML/CSS com placeholders). */
export interface CustomLayout {
  name: string;
  html: string;
  css: string;
}

export interface FeedStyle {
  size: PostCanvasSizeId;
  palette: FeedPalette;
  titleFont: TitleFontId;
  showPageNumber: boolean;
  align: "left" | "center";
  verticalAlign: "top" | "center" | "bottom";
  /** Multiplicador do tamanho dos títulos (0,7 a 1,4). */
  titleScale: number;
  decor: FeedDecor;
  /** Fundo do layout Destaque (sem foto): a cor de destaque ou o fundo normal da paleta. */
  coverBackground: "accent" | "background";
  customLayout: CustomLayout | null;
}

export const FEED_PALETTES: { name: string; palette: FeedPalette }[] = [
  { name: "Clássico", palette: { background: "#FFFFFF", text: "#16161A", accent: "#4F46E5" } },
  { name: "Creme", palette: { background: "#F4EDE4", text: "#2B2118", accent: "#C2410C" } },
  { name: "Noite", palette: { background: "#0F1115", text: "#F2F2F0", accent: "#A3E635" } },
  { name: "Oceano", palette: { background: "#EEF4F8", text: "#0B2533", accent: "#0E7490" } },
  { name: "Rosa", palette: { background: "#FFF1F4", text: "#3A0F1C", accent: "#DB2777" } },
  { name: "Floresta", palette: { background: "#F1F5EE", text: "#1C2B1A", accent: "#3F7D3A" } },
  { name: "Sol", palette: { background: "#FFFBEB", text: "#1F1A0E", accent: "#F59E0B" } },
  { name: "Grafite", palette: { background: "#1E1E22", text: "#F5F5F4", accent: "#F97316" } },
];

export const DEFAULT_FEED_STYLE: FeedStyle = {
  size: "portrait-4x5",
  palette: FEED_PALETTES[0].palette,
  titleFont: "sans",
  showPageNumber: true,
  align: "left",
  verticalAlign: "center",
  titleScale: 1,
  decor: "nenhum",
  coverBackground: "accent",
  customLayout: null,
};

/** Completa um estilo parcial (ex.: rascunho salvo numa versão anterior) com os valores padrão. */
export function resolveFeedStyle(style: Partial<FeedStyle>): FeedStyle {
  const merged = { ...DEFAULT_FEED_STYLE, ...style };
  return {
    ...merged,
    titleFont: merged.titleFont in TITLE_FONTS ? merged.titleFont : "sans",
    titleScale: Math.min(1.4, Math.max(0.7, Number(merged.titleScale) || 1)),
  };
}

const JUSTIFY = { top: "flex-start", center: "center", bottom: "flex-end" } as const;

/** Linhas de uma lista, sem marcadores ("-", "•", "1.") no começo. */
export function listItems(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-•*·–]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

function footerHtml(brand: FeedBrand, pageLabel: string | null): string {
  return `<div class="footer">
    <div class="brand">${logoHtml(brand)}<span>${escapeHtml(handleText(brand))}</span></div>
    ${pageLabel ? `<span class="page">${pageLabel}</span>` : ""}
  </div>`;
}

function logoHtml(brand: FeedBrand): string {
  const logoSrc = safeImageSrc(brand.logo);
  return logoSrc
    ? `<img class="logo" src="${logoSrc}" alt=""/>`
    : `<div class="logo initials">${escapeHtml(initials(brand.name))}</div>`;
}

function handleText(brand: FeedBrand): string {
  const handle = brand.handle.trim().replace(/^@+/, "");
  return handle ? `@${handle}` : brand.name.trim();
}

function decorHtml(decor: FeedDecor): string {
  switch (decor) {
    case "formas":
      return `<div class="decor"><span class="shape s1"></span><span class="shape s2"></span></div>`;
    case "pontos":
      return `<div class="decor"><span class="dots d1"></span><span class="dots d2"></span></div>`;
    case "moldura":
      return `<div class="decor"><span class="frame"></span></div>`;
    default:
      return "";
  }
}

export function renderFeedSlide(params: {
  slide: FeedSlide;
  brand: FeedBrand;
  style: Partial<FeedStyle>;
  index: number;
  total: number;
  fontCss: string;
  /** Número exibido no layout Seção (ver sectionNumberAt). */
  sectionNumber?: number;
}): string {
  const { slide, brand, index, total, fontCss } = params;
  const style = resolveFeedStyle(params.style);
  const { width, height } = CANVAS_SIZES[style.size];
  // No Story o Instagram cobre o topo (perfil) e a base (resposta): o conteúdo fica fora dessas faixas.
  const isStory = height / width > 1.6;
  const padTop = isStory ? Math.round((height * STORY_SAFE_ZONES.topPercent) / 100) : 88;
  const padBottom = isStory ? Math.round((height * STORY_SAFE_ZONES.bottomPercent) / 100) : 72;
  // Na Apresentação (16:9) o texto ganha margens laterais maiores e linhas mais curtas.
  const isLandscape = width > height;
  const padX = isLandscape ? 140 : 92;
  const sidePhotoWidth = Math.round(width * 0.46);
  let padLeft = padX;
  const shapeBase = Math.min(width, height);

  const bg = safeColor(style.palette.background, "#FFFFFF");
  const text = safeColor(style.palette.text, "#16161A");
  const accent = safeColor(style.palette.accent, "#4F46E5");
  const onAccent = contrastText(accent);
  const font = TITLE_FONTS[style.titleFont];
  const imageSrc = safeImageSrc(slide.image);
  const pageLabel = style.showPageNumber && total > 1 ? `${index + 1}/${total}` : null;
  // No 16:9 sobra espaço na largura: os títulos crescem um pouco.
  const ts = (size: number) => Math.round(size * style.titleScale * font.scale * (isLandscape ? 1.12 : 1));

  const title = formatRichText(slide.title);
  const body = formatRichText(slide.body);
  const hasTitle = Boolean(slide.title.trim());
  const hasBody = Boolean(slide.body.trim());

  // Por padrão a página usa o fundo e o texto da paleta; alguns layouts trocam.
  let pageBg = bg;
  let pageColor = text;
  let decorColor = accent;
  let decorAllowed = true;
  let content = "";

  const layout: FeedLayout = slide.layout === "referencia" && !style.customLayout ? "texto" : slide.layout;

  if (layout === "referencia" && style.customLayout) {
    return renderCustomLayout({ slide, brand, style, width, height, fontCss, pageLabel, colors: { bg, text, accent, onAccent }, ts });
  }

  switch (layout) {
    case "destaque": {
      const size = ts(sizeByLength(slide.title, [[30, 112], [60, 96], [110, 80], [180, 66]], 56));
      if (imageSrc) {
        pageBg = "#000000";
        pageColor = "#FFFFFF";
        decorAllowed = false;
      } else if (style.coverBackground === "accent") {
        pageBg = accent;
        pageColor = onAccent;
        decorColor = onAccent;
      }
      content = `
        ${imageSrc ? `<img class="cover-img" src="${imageSrc}" alt=""/><div class="cover-shade"></div>` : ""}
        <div class="main">
          ${iconSvg(slide.icon, `icon icon-plain${pageBg === bg ? " icon-accent" : ""}`)}
          ${hasTitle ? `<h1 class="title" style="font-size:${size}px">${title}</h1>` : ""}
          ${hasBody ? `<p class="lead">${body}</p>` : ""}
        </div>`;
      break;
    }
    case "texto": {
      const titleSize = ts(sizeByLength(slide.title, [[40, 72], [80, 60], [140, 52]], 46));
      const bodySize = sizeByLength(slide.body, [[160, 42], [300, 37], [480, 33]], 29);
      content = `
        <div class="main">
          ${slide.icon ? `<div class="badge">${iconSvg(slide.icon, "icon")}</div>` : `<div class="bar"></div>`}
          ${hasTitle ? `<h2 class="title" style="font-size:${titleSize}px;margin-bottom:40px">${title}</h2>` : ""}
          ${hasBody ? `<p class="body" style="font-size:${bodySize}px">${body}</p>` : ""}
        </div>`;
      break;
    }
    case "lista": {
      const items = listItems(slide.body);
      const titleSize = ts(sizeByLength(slide.title, [[40, 66], [80, 56]], 46));
      const twoColumns = isLandscape && items.length > 4;
      const rows = twoColumns ? Math.ceil(items.length / 2) : items.length;
      const itemSize = rows <= 3 ? 46 : rows <= 5 ? 40 : rows <= 7 ? 34 : 28;
      content = `
        <div class="main">
          ${slide.icon ? `<div class="badge">${iconSvg(slide.icon, "icon")}</div>` : ""}
          ${hasTitle ? `<h2 class="title" style="font-size:${titleSize}px;margin-bottom:44px">${title}</h2>` : ""}
          <ol class="list${twoColumns ? " two" : ""}" style="font-size:${itemSize}px">
            ${items.map((item, i) => `<li><span class="num">${String(i + 1).padStart(2, "0")}</span><span>${formatRichText(item)}</span></li>`).join("")}
          </ol>
        </div>`;
      break;
    }
    case "numero": {
      const numberSize = ts(sizeByLength(slide.title, [[3, 320], [5, 260], [8, 200], [12, 150]], 120));
      const bodySize = sizeByLength(slide.body, [[60, 48], [140, 40]], 34);
      content = `
        <div class="main">
          ${slide.icon ? `<div class="badge">${iconSvg(slide.icon, "icon")}</div>` : ""}
          ${hasTitle ? `<div class="title big-number" style="font-size:${numberSize}px">${title}</div>` : ""}
          <div class="rule"></div>
          ${hasBody ? `<p class="body" style="font-size:${bodySize}px">${body}</p>` : ""}
        </div>`;
      break;
    }
    case "citacao": {
      const quoteSize = ts(sizeByLength(slide.title, [[60, 76], [120, 64], [200, 54]], 46));
      content = `
        <div class="main">
          <div class="quote-mark">“</div>
          ${hasTitle ? `<blockquote class="title" style="font-size:${quoteSize}px">${title}</blockquote>` : ""}
          ${hasBody ? `<p class="author">— ${body}</p>` : ""}
        </div>`;
      break;
    }
    case "comparacao": {
      const [left, right] = slide.body.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
      const titleSize = ts(sizeByLength(slide.title, [[40, 60], [80, 50]], 42));
      const column = (part: string | undefined, kind: "before" | "after") => {
        if (!part) return "";
        const [label, ...rest] = part.split("\n");
        const mark = markSvg(kind === "before" ? "no" : "yes", "col-icon");
        return `<div class="col ${kind}">
          <div class="col-label">${mark}<span>${formatRichText(label)}</span></div>
          <ul>${listItems(rest.join("\n")).map((item) => `<li>${formatRichText(item)}</li>`).join("")}</ul>
        </div>`;
      };
      content = `
        <div class="main">
          ${hasTitle ? `<h2 class="title" style="font-size:${titleSize}px;margin-bottom:44px">${title}</h2>` : ""}
          <div class="compare${right && !isStory ? "" : " single"}">${column(left, right ? "before" : "after")}${column(right, "after")}</div>
        </div>`;
      break;
    }
    case "foto": {
      const titleSize = ts(sizeByLength(slide.title, [[40, 60], [90, 52]], 44));
      const bodySize = sizeByLength(slide.body, [[140, 34], [260, 30]], 27);
      decorAllowed = false;
      if (isLandscape) padLeft = sidePhotoWidth + 110;
      content = `
        <div class="photo${isLandscape ? " side" : ""}">${imageSrc ? `<img src="${imageSrc}" alt=""/>` : ""}</div>
        <div class="main main-photo">
          ${hasTitle ? `<h2 class="title" style="font-size:${titleSize}px;margin-bottom:24px">${title}</h2>` : ""}
          ${hasBody ? `<p class="body" style="font-size:${bodySize}px">${body}</p>` : ""}
        </div>`;
      break;
    }
    case "celular": {
      const titleSize = ts(sizeByLength(slide.title, [[30, 64], [70, 54]], 44));
      const bodySize = sizeByLength(slide.body, [[100, 34], [200, 30]], 26);
      const phoneHeight = isStory ? Math.min(980, height - padTop - padBottom - 420) : Math.min(820, height - 270);
      const phoneWidth = Math.round(phoneHeight * 0.48);
      const screen = imageSrc
        ? `<img src="${imageSrc}" alt=""/>`
        : `<div class="screen-empty">${iconSvg(slide.icon, "icon") || escapeHtml(initials(brand.name))}</div>`;
      content = `
        <div class="main main-phone${isStory ? " stacked" : ""}">
          <div class="phone-text">
            ${hasTitle ? `<h2 class="title" style="font-size:${titleSize}px;margin-bottom:28px">${title}</h2>` : ""}
            ${hasBody ? `<p class="body" style="font-size:${bodySize}px">${body}</p>` : ""}
          </div>
          <div class="phone" style="width:${phoneWidth}px;height:${phoneHeight}px"><div class="notch"></div><div class="screen">${screen}</div></div>
        </div>`;
      break;
    }
    case "sticker": {
      // Deixa um espaço livre onde a pessoa cola a enquete, a caixinha de perguntas ou o link no Instagram.
      const titleSize = ts(sizeByLength(slide.title, [[30, 92], [60, 78], [110, 64]], 54));
      const bodySize = sizeByLength(slide.body, [[80, 38], [160, 34]], 30);
      const slotTop = Math.round((height * STICKER_SLOT.topPercent) / 100);
      content = `
        <div class="main main-sticker" style="max-height:${slotTop - padTop - 40}px">
          ${slide.icon ? `<div class="badge">${iconSvg(slide.icon, "icon")}</div>` : ""}
          ${hasTitle ? `<h2 class="title" style="font-size:${titleSize}px;margin-bottom:28px">${title}</h2>` : ""}
          ${hasBody ? `<p class="body" style="font-size:${bodySize}px">${body}</p>` : ""}
        </div>
        <div class="sticker-slot" style="top:${slotTop}px;height:${Math.round((height * STICKER_SLOT.heightPercent) / 100)}px"></div>`;
      break;
    }
    case "cta": {
      const titleSize = ts(sizeByLength(slide.title, [[30, 100], [60, 84], [110, 68]], 56));
      content = `
        <div class="main main-cta">
          ${iconSvg(slide.icon, `icon icon-plain icon-accent`)}
          ${hasTitle ? `<h2 class="title" style="font-size:${titleSize}px">${title}</h2>` : ""}
          <div class="cta-btn">${markSvg("link", "cta-icon")}<span>${hasBody ? body : "Toque no link"}</span></div>
        </div>`;
      break;
    }
    case "secao": {
      // Divisória entre partes da apresentação: número grande, título e subtítulo.
      const size = ts(sizeByLength(slide.title, [[30, 120], [60, 100], [110, 80]], 64));
      if (style.coverBackground === "accent") {
        pageBg = accent;
        pageColor = onAccent;
        decorColor = onAccent;
      }
      const number = String(params.sectionNumber ?? 1).padStart(2, "0");
      content = `
        <div class="main main-section">
          <div class="section-number">${number}</div>
          ${iconSvg(slide.icon, `icon icon-plain${pageBg === bg ? " icon-accent" : ""}`)}
          ${hasTitle ? `<h1 class="title" style="font-size:${size}px">${title}</h1>` : ""}
          ${hasBody ? `<p class="lead">${body}</p>` : ""}
        </div>`;
      break;
    }
    case "colunas": {
      const blocks = columnBlocks(slide.body).slice(0, 4);
      const titleSize = ts(sizeByLength(slide.title, [[40, 64], [80, 54]], 46));
      const textSize = blocks.length <= 2 ? 36 : blocks.length === 3 ? 32 : 28;
      const cards = blocks
        .map(
          (block, i) => `<div class="card">
            <span class="card-num">${String(i + 1).padStart(2, "0")}</span>
            <h3 class="card-title">${formatRichText(block.label)}</h3>
            ${block.text ? `<p class="card-text" style="font-size:${textSize}px">${formatRichText(block.text)}</p>` : ""}
          </div>`,
        )
        .join("");
      content = `
        <div class="main">
          ${slide.icon ? `<div class="badge">${iconSvg(slide.icon, "icon")}</div>` : ""}
          ${hasTitle ? `<h2 class="title" style="font-size:${titleSize}px;margin-bottom:56px">${title}</h2>` : ""}
          <div class="cards" style="grid-template-columns:repeat(${isLandscape ? Math.max(1, blocks.length) : 1},1fr)">${cards}</div>
        </div>`;
      break;
    }
  }

  const align = style.align;
  const css = `
body{background:${pageBg};color:${pageColor};font-family:"Inter",Arial,sans-serif}
${style.decor === "degrade" && decorAllowed ? `body{background:linear-gradient(160deg,${pageBg} 0%,color-mix(in srgb,${decorColor} 22%,${pageBg}) 100%)}` : ""}
.page-wrap{position:relative;width:${width}px;height:${height}px;padding:${padTop}px ${padX}px ${padBottom}px ${padLeft}px;display:flex;flex-direction:column;overflow:hidden}
.page-wrap>*{position:relative;z-index:1}
.main{flex:1;display:flex;flex-direction:column;justify-content:${JUSTIFY[style.verticalAlign]};align-items:${align === "center" ? "center" : "flex-start"};text-align:${align};min-height:0}
.title{font-family:${font.stack};font-weight:${font.weight};line-height:${font.uppercase ? 1 : 1.08};letter-spacing:${font.tracking};${font.uppercase ? "text-transform:uppercase;" : ""}overflow-wrap:break-word;max-width:100%}
strong{font-weight:700}
.lead{margin-top:40px;font-size:38px;line-height:1.4;opacity:.88;max-width:${isLandscape ? 1200 : 860}px}
.body{line-height:1.45;overflow-wrap:break-word;max-width:${isLandscape ? "1400px" : "100%"}}
.body strong,.list strong,.compare strong{color:${accent}}
.icon{width:72px;height:72px;stroke-width:1.75}
.icon-plain{width:120px;height:120px;margin-bottom:40px}
.icon-accent{color:${accent}}
.badge{width:120px;height:120px;border-radius:32px;background:${accent};color:${onAccent};display:flex;align-items:center;justify-content:center;margin-bottom:44px;flex-shrink:0}
.bar{width:96px;height:12px;border-radius:6px;background:${accent};margin-bottom:48px}
.cover-img{position:absolute!important;inset:0;width:100%;height:100%;object-fit:cover;z-index:0!important}
.cover-shade{position:absolute!important;inset:0;z-index:0!important;background:linear-gradient(180deg,rgba(0,0,0,.2) 0%,rgba(0,0,0,.55) 45%,rgba(0,0,0,.9) 100%)}
.list{list-style:none;display:flex;flex-direction:column;gap:.75em;text-align:left;line-height:1.3}
.list li{display:flex;align-items:flex-start;gap:28px}
.list.two{display:grid;grid-template-columns:1fr 1fr;column-gap:96px;row-gap:.75em;width:100%}
.num{flex-shrink:0;min-width:1.9em;height:1.9em;border-radius:50%;background:${accent};color:${onAccent};font-weight:700;font-size:.8em;display:flex;align-items:center;justify-content:center;margin-top:-.15em}
.big-number{color:${accent};line-height:.95}
.rule{width:120px;height:10px;border-radius:5px;background:${accent};margin:40px 0 36px;opacity:.35}
.quote-mark{font-family:"Playfair Display",Georgia,serif;font-size:260px;line-height:.8;height:150px;color:${accent}}
blockquote.title{margin-top:24px}
.author{margin-top:48px;font-size:34px;opacity:.7}
.compare{display:grid;grid-template-columns:1fr 1fr;gap:28px;width:100%;text-align:left}
.compare.single{grid-template-columns:1fr}
.col{border-radius:32px;padding:48px 44px;font-size:34px;line-height:1.35}
.col.before{background:color-mix(in srgb,${text} 7%,transparent);color:color-mix(in srgb,${text} 75%,transparent)}
.col.after{background:color-mix(in srgb,${accent} 12%,transparent);border:4px solid ${accent}}
.col-label{display:flex;align-items:center;gap:14px;font-weight:700;font-size:40px;margin-bottom:32px}
.col-icon{width:46px;height:46px;flex-shrink:0;stroke-width:2.5}
.after .col-icon{color:${accent}}
.col ul{list-style:none;display:flex;flex-direction:column;gap:18px}
.col li{padding-left:28px;position:relative}
.col li:before{content:"";position:absolute;left:0;top:.55em;width:10px;height:10px;border-radius:50%;background:currentColor;opacity:.5}
.photo{margin:-${padTop}px -${padX}px 56px;height:${Math.round(height * (isStory ? 0.5 : 0.56))}px;background:${accent};flex-shrink:0}
.photo img{width:100%;height:100%;object-fit:cover;display:block}
.photo.side{position:absolute!important;left:0;top:0;bottom:0;width:${sidePhotoWidth}px;height:auto;margin:0}
.photo.side~.main-photo{justify-content:${JUSTIFY[style.verticalAlign]}}
.main-photo{justify-content:flex-start}
.main-phone{flex-direction:row;align-items:center;justify-content:space-between;gap:56px;text-align:left}
.main-phone.stacked{flex-direction:column;align-items:stretch;justify-content:flex-start;gap:56px}
.main-phone.stacked .phone{align-self:center}
.main-phone.stacked .phone-text{flex:none}
.main-sticker{flex:none;justify-content:flex-start;overflow:hidden}
.main-sticker~.footer{margin-top:auto}
.sticker-slot{position:absolute!important;left:92px;right:92px}
.main-cta{justify-content:center;align-items:center;text-align:center}
.cta-btn{margin-top:64px;display:inline-flex;align-items:center;gap:20px;padding:32px 60px;border-radius:999px;background:${accent};color:${onAccent};font-size:42px;font-weight:700;box-shadow:0 24px 48px rgba(0,0,0,.18)}
.cta-icon{width:48px;height:48px;stroke-width:2.5;flex-shrink:0}
.section-number{font-family:${font.stack};font-weight:800;font-size:220px;line-height:.9;opacity:.22;margin-bottom:24px}
.main-section .icon-plain{margin-bottom:32px}
.cards{display:grid;gap:32px;width:100%;text-align:left}
.card{border-radius:32px;padding:52px 48px;background:color-mix(in srgb,${accent} 9%,transparent);border-top:8px solid ${accent}}
.card-num{display:block;font-weight:800;font-size:30px;color:${accent};margin-bottom:22px}
.card-title{font-family:${font.stack};font-weight:${font.weight};${font.uppercase ? "text-transform:uppercase;" : ""}font-size:44px;line-height:1.15;margin-bottom:20px}
.card-text{line-height:1.45;opacity:.85}
.card-text strong{color:${accent}}
.phone-text{flex:1;min-width:0}
.phone{flex-shrink:0;border-radius:64px;background:#0B0B0C;padding:16px;position:relative;box-shadow:0 40px 80px rgba(0,0,0,.25)}
.notch{position:absolute;top:30px;left:50%;transform:translateX(-50%);width:34%;height:28px;border-radius:14px;background:#0B0B0C;z-index:2}
.screen{width:100%;height:100%;border-radius:50px;overflow:hidden;background:${accent}}
.screen img{width:100%;height:100%;object-fit:cover;display:block}
.screen-empty{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:${onAccent};font-size:72px;font-weight:700;background:linear-gradient(160deg,${accent},color-mix(in srgb,${accent} 55%,#000))}
.screen-empty .icon{width:140px;height:140px}
.footer{display:flex;align-items:center;justify-content:space-between;margin-top:40px;font-size:28px;font-weight:700;flex-shrink:0;color:${pageColor}}
.brand{display:flex;align-items:center;gap:16px}
.logo{width:56px;height:56px;border-radius:50%;object-fit:cover}
.initials{display:flex;align-items:center;justify-content:center;font-size:22px;background:${pageBg === accent ? onAccent : accent};color:${pageBg === accent ? accent : onAccent}}
.page{opacity:.6;font-weight:400}
.decor{position:absolute!important;inset:0;z-index:0!important;pointer-events:none}
.shape{position:absolute;border-radius:50%;background:${decorColor}}
.s1{width:${Math.round(shapeBase * 0.7)}px;height:${Math.round(shapeBase * 0.7)}px;right:-${Math.round(shapeBase * 0.25)}px;top:-${Math.round(shapeBase * 0.3)}px;opacity:.10}
.s2{width:${Math.round(shapeBase * 0.32)}px;height:${Math.round(shapeBase * 0.32)}px;left:-${Math.round(shapeBase * 0.1)}px;bottom:-${Math.round(shapeBase * 0.08)}px;opacity:.14}
.dots{position:absolute;width:340px;height:340px;background-image:radial-gradient(${decorColor} 4px,transparent 4.5px);background-size:38px 38px;opacity:.35}
.d1{right:48px;top:48px}
.d2{left:40px;bottom:150px;width:220px;height:220px;opacity:.22}
.frame{position:absolute;inset:36px;border:3px solid ${decorColor};border-radius:28px;opacity:.45}
`;

  const decor = decorAllowed ? decorHtml(style.decor) : "";
  const bodyHtml = `<div class="page-wrap">${decor}${content}${footerHtml(brand, pageLabel)}</div>`;
  return htmlDocument({ width, height, fontCss, css, body: bodyHtml });
}

function renderCustomLayout(params: {
  slide: FeedSlide;
  brand: FeedBrand;
  style: FeedStyle;
  width: number;
  height: number;
  fontCss: string;
  pageLabel: string | null;
  colors: { bg: string; text: string; accent: string; onAccent: string };
  ts: (size: number) => number;
}): string {
  const { slide, brand, style, width, height, fontCss, pageLabel, colors, ts } = params;
  const custom = style.customLayout!;
  const font = TITLE_FONTS[style.titleFont];
  const imageSrc = safeImageSrc(slide.image) ?? "";

  // Primeiro limpa o HTML da IA; depois insere o conteúdo do slide, que já sai escapado.
  const replacements: Record<string, string> = {
    title: formatRichText(slide.title),
    body: formatRichText(slide.body),
    brand: escapeHtml(brand.name.trim()),
    handle: escapeHtml(handleText(brand)),
    page: pageLabel ?? "",
    logo: logoHtml(brand),
    image: imageSrc ? `<img class="ref-image" src="${imageSrc}" alt=""/>` : "",
    image_url: imageSrc,
    icon: iconSvg(slide.icon, "ref-icon"),
  };
  const fill = (source: string) => source.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => replacements[key] ?? "");

  const html = fill(sanitizeLayoutHtml(custom.html));
  const customCss = sanitizeLayoutCss(custom.css).replace(/\{\{image_url\}\}/g, imageSrc);

  const css = `
:root{--bg:${colors.bg};--text:${colors.text};--accent:${colors.accent};--on-accent:${colors.onAccent};--title-font:${font.stack};--title-weight:${font.weight};--title-transform:${font.uppercase ? "uppercase" : "none"};--title-size:${ts(sizeByLength(slide.title, [[30, 104], [60, 88], [110, 72], [180, 60]], 52))}px;--body-size:${sizeByLength(slide.body, [[120, 40], [260, 35], [420, 31]], 28)}px}
body{background:var(--bg);color:var(--text);font-family:"Inter",Arial,sans-serif}
.ref-root{position:relative;width:${width}px;height:${height}px;overflow:hidden}
.ref-image{display:block;width:100%;height:100%;object-fit:cover}
.ref-icon{width:1em;height:1em}
.logo{width:56px;height:56px;border-radius:50%;object-fit:cover}
.initials{display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;background:var(--accent);color:var(--on-accent)}
${customCss}
`;
  return htmlDocument({ width, height, fontCss, css, body: `<div class="ref-root">${html}</div>` });
}

/**
 * Transforma um texto corrido em slides: cada bloco separado por linha em branco
 * vira um slide; a primeira linha do bloco é o título e o resto é o texto.
 * Uma linha com apenas "---" também separa slides (útil para blocos com parágrafos).
 */
export function splitContentIntoSlides(content: string): FeedSlide[] {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const blocks = /^\s*---\s*$/m.test(normalized) ? normalized.split(/^\s*---\s*$/m) : normalized.split(/\n\s*\n/);

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
        icon: null,
      } satisfies FeedSlide;
    });
}
