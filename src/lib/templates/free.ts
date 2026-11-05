// Layout "Livre": o slide é um fundo (cor, destaque ou foto) com sombra ajustável e uma lista de
// elementos posicionados em % do canvas (título, texto, etiqueta, perfil, imagem, cartão...).
// Mesmo motor HTML → PNG dos outros layouts: o preview continua sendo a imagem final.

import type { FeedBrand, FeedPalette } from "./feed";
import { TITLE_FONTS, type TitleFontId } from "./fonts";
import { contrastText, escapeHtml, formatRichText, htmlDocument, initials, safeColor, safeImageSrc } from "./utils";

export const FREE_ELEMENT_KINDS = ["titulo", "texto", "etiqueta", "perfil", "arraste", "numeracao", "imagem", "grade", "cartao"] as const;
export type FreeElementKind = (typeof FREE_ELEMENT_KINDS)[number];

export const FREE_ELEMENT_LABELS: Record<FreeElementKind, string> = {
  titulo: "Título",
  texto: "Texto",
  etiqueta: "Etiqueta",
  perfil: "Perfil (@)",
  arraste: "Arraste →",
  numeracao: "Numeração",
  imagem: "Imagem",
  grade: "Tiras / grade de fotos",
  cartao: "Cartão",
};

/** Arranjos do elemento Tiras / grade. */
export const FREE_GRIDS = ["2v", "3v", "2h", "2x2"] as const;
export type FreeGrid = (typeof FREE_GRIDS)[number];
export const FREE_GRID_LABELS: Record<FreeGrid, string> = { "2v": "2 tiras lado a lado", "3v": "3 tiras lado a lado", "2h": "2 faixas empilhadas", "2x2": "Grade 2 × 2" };
export const gridSlots = (grid: FreeGrid | undefined) => (grid === "3v" ? 3 : grid === "2x2" ? 4 : 2);

export const FREE_COLORS = ["texto", "fundo", "destaque", "branco", "preto"] as const;
export type FreeColor = (typeof FREE_COLORS)[number];
export const FREE_COLOR_LABELS: Record<FreeColor, string> = { texto: "Texto", fundo: "Fundo", destaque: "Destaque", branco: "Branco", preto: "Preto" };

/** Como as palavras entre **asteriscos** aparecem. */
export const FREE_HIGHLIGHTS = ["cor", "marca", "negrito"] as const;
export type FreeHighlight = (typeof FREE_HIGHLIGHTS)[number];
export const FREE_HIGHLIGHT_LABELS: Record<FreeHighlight, string> = { cor: "Na cor de destaque", marca: "Marca-texto", negrito: "Só negrito" };

export const FREE_BACKGROUNDS = ["fundo", "destaque", "foto"] as const;
export const FREE_OVERLAYS = ["nenhuma", "suave", "base", "forte", "total"] as const;
export const FREE_OVERLAY_LABELS: Record<(typeof FREE_OVERLAYS)[number], string> = {
  nenhuma: "Sem sombra",
  suave: "Suave",
  base: "Base forte",
  forte: "Forte",
  total: "Escurecer tudo",
};

export interface FreeElement {
  id: string;
  kind: FreeElementKind;
  /** Posição e largura em % do canvas. */
  x: number;
  y: number;
  w: number;
  /** Altura em % (só imagem e cartão; textos crescem conforme o conteúdo). */
  h?: number;
  text?: string;
  /** Tamanho da fonte em px no canvas (1080 de largura no feed). */
  size?: number;
  align?: "left" | "center" | "right";
  color?: FreeColor;
  highlight?: FreeHighlight;
  upper?: boolean;
  font?: "titulo" | "corpo";
  image?: string | null;
  /** Tiras / grade: arranjo, fotos de cada espaço e espaço entre elas (px). */
  grid?: FreeGrid;
  images?: (string | null)[];
  gap?: number;
  /** Fundo da etiqueta ou do cartão. */
  fill?: FreeColor | "vidro";
  radius?: number;
}

export interface FreeSlide {
  bg: (typeof FREE_BACKGROUNDS)[number];
  overlay: (typeof FREE_OVERLAYS)[number];
  /** Barrinhas de progresso no topo (estilo story). */
  progress?: boolean;
  /** Carrossel infinito: a foto de fundo ocupa `total` slides lado a lado e este mostra o pedaço `part`. */
  pan?: { total: number; part: number } | null;
  elements: FreeElement[];
}

const clamp = (n: number | undefined, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n as number)) : fallback;

const OVERLAY_CSS: Record<FreeSlide["overlay"], string> = {
  nenhuma: "transparent",
  suave: "linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.55) 100%)",
  base: "linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.6) 62%,rgba(0,0,0,.92) 100%)",
  forte: "linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,.55) 45%,rgba(0,0,0,.95) 100%)",
  total: "rgba(0,0,0,.55)",
};

export function renderFreeSlide(params: {
  free: FreeSlide;
  image: string | null | undefined;
  brand: FeedBrand;
  palette: FeedPalette;
  titleFont: TitleFontId;
  width: number;
  height: number;
  index: number;
  total: number;
  fontCss: string;
}): string {
  const { free, brand, width, height, index, total, fontCss } = params;
  const bg = safeColor(params.palette.background, "#FFFFFF");
  const text = safeColor(params.palette.text, "#16161A");
  const accent = safeColor(params.palette.accent, "#4F46E5");
  const onAccent = contrastText(accent);
  const font = TITLE_FONTS[params.titleFont] ?? TITLE_FONTS.sans;
  const photo = free.bg === "foto" ? safeImageSrc(params.image) : null;

  const pageBg = free.bg === "destaque" ? accent : photo ? "#000000" : bg;
  // Cor "texto" se adapta ao fundo: sobre foto ou destaque fica legível sozinha.
  const autoText = photo ? "#FFFFFF" : free.bg === "destaque" ? onAccent : text;
  const colorOf = (c: FreeColor | undefined, fallback: string) =>
    c === "fundo" ? bg : c === "destaque" ? accent : c === "branco" ? "#FFFFFF" : c === "preto" ? "#0B0B0C" : c === "texto" ? autoText : fallback;

  const logoSrc = safeImageSrc(brand.logo);
  const handle = brand.handle.trim().replace(/^@+/, "");

  const elements = free.elements.slice(0, 40).map((el) => {
    const x = clamp(el.x, -20, 100, 8);
    const y = clamp(el.y, -20, 100, 8);
    const w = clamp(el.w, 2, 140, 80);
    const h = clamp(el.h, 1, 140, 20);
    const size = clamp(el.size, 10, 400, 40);
    const align = el.align === "center" || el.align === "right" ? el.align : "left";
    const color = colorOf(el.color, autoText);
    const box = `left:${x}%;top:${y}%;width:${w}%;text-align:${align};`;
    const highlight = el.highlight === "marca" ? " hl-marca" : el.highlight === "negrito" ? " hl-negrito" : " hl-cor";
    const upper = el.upper ? "text-transform:uppercase;" : "";
    const useTitleFont = el.font === "titulo" || (!el.font && el.kind === "titulo");
    const fontStyle = (useTitleFont
      ? `font-family:${font.stack};font-weight:${font.weight};line-height:${font.uppercase ? 1 : 1.06};letter-spacing:${font.tracking};${font.uppercase ? "text-transform:uppercase;" : ""}`
      : `font-family:"Inter",Arial,sans-serif;font-weight:400;line-height:1.4;`
    ).replace(/"/g, "'"); // vai dentro de style="...": aspas duplas na pilha de fontes cortariam o atributo
    const content = formatRichText(el.text ?? "");

    switch (el.kind) {
      case "titulo":
      case "texto":
        return `<div class="el${highlight}" style="${box}font-size:${size}px;color:${color};${fontStyle}${upper}">${content}</div>`;
      case "etiqueta": {
        const fill = el.fill === "vidro" ? "rgba(255,255,255,.16)" : colorOf(el.fill as FreeColor | undefined, accent);
        const ink = el.color ? color : el.fill === "vidro" ? "#FFFFFF" : contrastText(fill.startsWith("#") ? fill : accent);
        return `<div class="el" style="${box}"><span class="tag" style="font-size:${size}px;background:${fill};color:${ink};${upper}">${content}</span></div>`;
      }
      case "perfil": {
        const logo = logoSrc
          ? `<img class="avatar" src="${logoSrc}" alt="" style="width:${size * 2}px;height:${size * 2}px"/>`
          : `<span class="avatar initials" style="width:${size * 2}px;height:${size * 2}px;font-size:${Math.round(size * 0.8)}px">${escapeHtml(initials(brand.name))}</span>`;
        return `<div class="el profile" style="${box}font-size:${size}px;color:${color};justify-content:${align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start"}">${logo}<span class="who"><b>${escapeHtml(brand.name.trim())}</b>${handle ? `<small>@${escapeHtml(handle)}</small>` : ""}</span></div>`;
      }
      case "arraste":
        return `<div class="el t-body" style="${box}font-size:${size}px;color:${color};opacity:.85">${content || "Arraste →"}</div>`;
      case "numeracao":
        return `<div class="el t-body" style="${box}font-size:${size}px;color:${color};opacity:.7">${index + 1}/${total}</div>`;
      case "imagem": {
        const src = safeImageSrc(el.image);
        const radius = clamp(el.radius, 0, 200, 24);
        return src
          ? `<div class="el" style="${box}height:${h}%;border-radius:${radius}px;overflow:hidden"><img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/></div>`
          : `<div class="el img-empty" style="${box}height:${h}%;border-radius:${radius}px">Imagem</div>`;
      }
      case "grade": {
        const grid = (FREE_GRIDS as readonly string[]).includes(el.grid ?? "") ? (el.grid as FreeGrid) : "2v";
        const slots = gridSlots(grid);
        const gap = clamp(el.gap, 0, 80, 12);
        const radius = clamp(el.radius, 0, 200, 20);
        const template = grid === "2h" ? "grid-template-rows:1fr 1fr" : grid === "2x2" ? "grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr" : `grid-template-columns:repeat(${slots},1fr)`;
        const cells = Array.from({ length: slots }, (_, i) => {
          const src = safeImageSrc(el.images?.[i]);
          return src
            ? `<div style="border-radius:${radius}px;overflow:hidden"><img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/></div>`
            : `<div class="img-empty" style="border-radius:${radius}px;position:static">Foto ${i + 1}</div>`;
        }).join("");
        return `<div class="el" style="${box}height:${h}%;display:grid;${template};gap:${gap}px">${cells}</div>`;
      }
      case "cartao": {
        const fill = el.fill === "vidro" ? "rgba(255,255,255,.14)" : colorOf(el.fill as FreeColor | undefined, "#FFFFFF");
        const radius = clamp(el.radius, 0, 200, 36);
        return `<div class="el" style="${box}height:${h}%;border-radius:${radius}px;background:${fill};box-shadow:0 30px 60px rgba(0,0,0,.18)"></div>`;
      }
    }
  });

  const progress = free.progress && total > 1
    ? `<div class="progress">${Array.from({ length: total }, (_, i) => `<span class="${i <= index ? "on" : ""}"></span>`).join("")}</div>`
    : "";

  const css = `
body{background:${pageBg};color:${autoText};font-family:"Inter",Arial,sans-serif}
.root{position:relative;width:${width}px;height:${height}px;overflow:hidden}
.photo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;max-width:none}
.shade{position:absolute;inset:0;background:${photo ? OVERLAY_CSS[free.overlay] ?? "transparent" : "transparent"}}
.el{position:absolute;overflow-wrap:break-word}
.t-body{font-family:"Inter",Arial,sans-serif;line-height:1.4}
strong{font-weight:700}
.hl-cor strong{color:${accent}}
.hl-negrito strong{font-weight:800}
.hl-marca strong{background:${accent};color:${onAccent};padding:0 .14em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.tag{display:inline-block;padding:.45em 1.1em;border-radius:999px;font-weight:700;letter-spacing:.04em;line-height:1.2}
.profile{display:flex;align-items:center;gap:.7em}
.avatar{border-radius:50%;object-fit:cover;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${accent};color:${onAccent};font-weight:700}
.who{display:flex;flex-direction:column;line-height:1.2}
.who b{font-weight:700}
.who small{font-size:.8em;opacity:.75}
.img-empty{display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,${autoText} 10%,transparent);border:3px dashed color-mix(in srgb,${autoText} 35%,transparent);color:color-mix(in srgb,${autoText} 55%,transparent);font-size:32px}
.progress{position:absolute;left:4%;right:4%;top:2.4%;display:flex;gap:10px}
.progress span{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.35)}
.progress span.on{background:rgba(255,255,255,.95)}
`;
  const pan = free.pan && free.pan.total > 1 ? { total: Math.min(10, Math.round(free.pan.total)), part: Math.round(free.pan.part) } : null;
  const photoStyle = pan ? ` style="width:${pan.total * 100}%;left:${-Math.min(pan.total - 1, Math.max(0, pan.part)) * 100}%"` : "";
  const body = `<div class="root">${photo ? `<img class="photo" src="${photo}" alt=""${photoStyle}/><div class="shade"></div>` : ""}${progress}${elements.join("")}</div>`;
  return htmlDocument({ width, height, fontCss, css, body });
}

// ---------- Modelos prontos (pontos de partida editáveis) ----------

let counter = 0;
export const newElementId = () => `el-${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function newFreeElement(kind: FreeElementKind, over: Partial<FreeElement> = {}): FreeElement {
  const base: Record<FreeElementKind, Partial<FreeElement>> = {
    titulo: { x: 8, y: 40, w: 84, size: 96, text: "Seu **título** aqui", highlight: "cor" },
    texto: { x: 8, y: 62, w: 80, size: 38, text: "Texto de apoio do slide." },
    etiqueta: { x: 8, y: 30, w: 84, size: 26, text: "ETIQUETA", fill: "destaque", upper: true },
    perfil: { x: 8, y: 88, w: 60, size: 26 },
    arraste: { x: 62, y: 90, w: 30, size: 24, align: "right", text: "Arraste →" },
    numeracao: { x: 80, y: 4, w: 12, size: 24, align: "right" },
    imagem: { x: 8, y: 20, w: 84, h: 40, radius: 28 },
    grade: { x: 0, y: 0, w: 100, h: 62, grid: "2v", images: [], gap: 10, radius: 0 },
    cartao: { x: 6, y: 10, w: 88, h: 74, fill: "branco", radius: 40 },
  };
  return { id: newElementId(), kind, ...base[kind], ...over } as FreeElement;
}

export interface FreePresetInput {
  title: string;
  body: string;
  hasImage: boolean;
}

export const FREE_PRESETS: { id: string; label: string; build: (input: FreePresetInput) => FreeSlide }[] = [
  {
    id: "capa-revista",
    label: "Capa revista",
    build: ({ title, body, hasImage }) => ({
      bg: hasImage ? "foto" : "fundo",
      overlay: "base",
      progress: true,
      elements: [
        newFreeElement("etiqueta", { x: 8, y: 52, w: 84, text: body ? body.split("\n")[0].slice(0, 40) : "TEMA DO POST", fill: "vidro" }),
        newFreeElement("titulo", { x: 8, y: 58, w: 84, size: 104, text: title || "Título **forte** para a capa", upper: true, highlight: "cor" }),
        newFreeElement("perfil", { x: 8, y: 90, w: 55, size: 24 }),
        newFreeElement("arraste", { x: 62, y: 91.5, w: 30, size: 22 }),
      ],
    }),
  },
  {
    id: "capa-marca-texto",
    label: "Capa marca-texto",
    build: ({ title, hasImage }) => ({
      bg: hasImage ? "foto" : "fundo",
      overlay: "forte",
      elements: [
        newFreeElement("titulo", { x: 8, y: 56, w: 84, size: 100, text: title || "O **futuro** do seu **negócio** começa aqui", upper: true, highlight: "marca" }),
        newFreeElement("perfil", { x: 8, y: 90, w: 55, size: 24 }),
        newFreeElement("arraste", { x: 62, y: 91.5, w: 30, size: 22 }),
      ],
    }),
  },
  {
    id: "capa-tiras",
    label: "Capa com 2 tiras",
    build: ({ title }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      progress: true,
      elements: [
        newFreeElement("grade", { x: 0, y: 0, w: 100, h: 60, grid: "2v", gap: 8, radius: 0 }),
        newFreeElement("titulo", { x: 8, y: 64, w: 84, size: 92, text: title || "Antes e **depois** em 30 dias", upper: true }),
        newFreeElement("perfil", { x: 8, y: 90, w: 55, size: 24 }),
        newFreeElement("arraste", { x: 62, y: 91.5, w: 30, size: 22 }),
      ],
    }),
  },
  {
    id: "capa-3-tiras",
    label: "Capa com 3 tiras",
    build: ({ title }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        newFreeElement("grade", { x: 4, y: 4, w: 92, h: 56, grid: "3v", gap: 12, radius: 24 }),
        newFreeElement("titulo", { x: 8, y: 64, w: 84, size: 88, text: title || "3 **formas** de começar hoje", upper: true }),
        newFreeElement("perfil", { x: 8, y: 90, w: 55, size: 24 }),
        newFreeElement("arraste", { x: 62, y: 91.5, w: 30, size: 22 }),
      ],
    }),
  },
  {
    id: "interno-cartao",
    label: "Interno com cartão",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        newFreeElement("cartao", { x: 6, y: 8, w: 88, h: 78, fill: "branco" }),
        newFreeElement("etiqueta", { x: 12, y: 13, w: 76, size: 22, text: "DESTAQUE", fill: "destaque" }),
        newFreeElement("titulo", { x: 12, y: 20, w: 76, size: 64, text: title || "Chega de **conteúdo** sem resultado", color: "preto", upper: true }),
        newFreeElement("texto", { x: 12, y: 42, w: 76, size: 32, text: body || "Explique aqui a ideia principal deste slide em duas ou três frases curtas.", color: "preto" }),
        newFreeElement("perfil", { x: 8, y: 90, w: 55, size: 22 }),
        newFreeElement("arraste", { x: 62, y: 91.5, w: 30, size: 22 }),
      ],
    }),
  },
  {
    id: "interno-texto",
    label: "Interno simples",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        newFreeElement("perfil", { x: 8, y: 30, w: 70, size: 26 }),
        newFreeElement("titulo", { x: 8, y: 38, w: 84, size: 72, text: title || "O mito se torna **realidade**", upper: true }),
        newFreeElement("texto", { x: 8, y: 56, w: 84, size: 36, text: body || "Texto de apoio do slide, direto ao ponto." }),
        newFreeElement("numeracao", { x: 80, y: 92, w: 12, size: 22 }),
      ],
    }),
  },
  {
    id: "foto-com-texto",
    label: "Foto em cima, texto embaixo",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        newFreeElement("imagem", { x: 0, y: 0, w: 100, h: 52, radius: 0 }),
        newFreeElement("titulo", { x: 8, y: 57, w: 84, size: 64, text: title || "Título do slide" }),
        newFreeElement("texto", { x: 8, y: 74, w: 84, size: 32, text: body || "Texto de apoio." }),
        newFreeElement("perfil", { x: 8, y: 91, w: 55, size: 22 }),
      ],
    }),
  },
];
