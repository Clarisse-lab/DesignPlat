// Layout "Livre": o slide é um fundo (cor, destaque ou foto) com sombra ajustável e uma lista de
// elementos posicionados em % do canvas (título, texto, etiqueta, perfil, imagem, cartão...).
// Mesmo motor HTML → PNG dos outros layouts: o preview continua sendo a imagem final.

import type { FeedBrand, FeedPalette } from "./feed";
import { TITLE_FONT_IDS, TITLE_FONTS, type TitleFontId } from "./fonts";
import { ICON_IDS, iconSvg, type IconId } from "./icons";
import { contrastRatio, contrastText, escapeHtml, formatRichText, htmlDocument, initials, safeColor, safeImageSrc } from "./utils";

export const FREE_ELEMENT_KINDS = ["titulo", "texto", "etiqueta", "perfil", "arraste", "numeracao", "imagem", "grade", "cartao", "icone", "conversa", "mancha"] as const;
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
  cartao: "Cartão ou faixa",
  icone: "Ícone",
  conversa: "Print de conversa",
  mancha: "Mancha de tinta",
};

/**
 * Estilos do Print de conversa. Montado só com HTML (custo zero de IA): parece um print real,
 * sem logotipo nem nome de aplicativo de terceiros.
 */
export const FREE_CHAT_STYLES = ["escuro", "claro", "notificacoes"] as const;
export type FreeChatStyle = (typeof FREE_CHAT_STYLES)[number];
export const FREE_CHAT_LABELS: Record<FreeChatStyle, string> = {
  escuro: "Conversa (modo escuro)",
  claro: "Conversa (modo claro)",
  notificacoes: "Notificações na tela bloqueada",
};

export interface ChatMessage {
  mine: boolean;
  text: string;
}

/** Uma mensagem por linha; "Eu:" no começo vira resposta (balão da direita). */
export function parseChatMessages(text: string | undefined): ChatMessage[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((line) => {
      const mine = /^eu\s*:/i.test(line);
      return { mine, text: mine ? line.replace(/^eu\s*:\s*/i, "") : line };
    })
    .filter((m) => m.text);
}

/** Soma minutos a "HH:MM" (horários que andam devagar, como numa conversa de verdade). */
export function addMinutes(time: string, minutes: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time;
  const total = (Number(match[1]) * 60 + Number(match[2]) + minutes) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Idade das notificações, da mais nova para a mais antiga (números "quebrados", não redondos). */
const NOTIFICATION_AGES = ["agora", "2 min", "7 min", "13 min", "26 min", "41 min", "1 h"];

/** Estilos do elemento Perfil. */
export const FREE_PROFILE_VARIANTS = ["linha", "chip", "tweet"] as const;
export type FreeProfileVariant = (typeof FREE_PROFILE_VARIANTS)[number];
export const FREE_PROFILE_LABELS: Record<FreeProfileVariant, string> = {
  linha: "Foto + nome + @",
  chip: "Etiqueta com foto e @",
  tweet: "Estilo tweet (selo de verificado)",
};
export { ICON_IDS, TITLE_FONT_IDS };

/** Arranjos do elemento Tiras / grade. */
export const FREE_GRIDS = ["2v", "3v", "2h", "2x2"] as const;
export type FreeGrid = (typeof FREE_GRIDS)[number];
export const FREE_GRID_LABELS: Record<FreeGrid, string> = { "2v": "2 tiras lado a lado", "3v": "3 tiras lado a lado", "2h": "2 faixas empilhadas", "2x2": "Grade 2 × 2" };
export const gridSlots = (grid: FreeGrid | undefined) => (grid === "3v" ? 3 : grid === "2x2" ? 4 : 2);

export const FREE_COLORS = ["texto", "fundo", "destaque", "branco", "preto"] as const;
export type FreeColor = (typeof FREE_COLORS)[number];
export const FREE_COLOR_LABELS: Record<FreeColor, string> = { texto: "Texto", fundo: "Fundo", destaque: "Destaque", branco: "Branco", preto: "Preto" };

/** Como as palavras entre **asteriscos** aparecem. */
export const FREE_HIGHLIGHTS = ["cor", "marca", "negrito", "caneta", "faixa"] as const;
export type FreeHighlight = (typeof FREE_HIGHLIGHTS)[number];
export const FREE_HIGHLIGHT_LABELS: Record<FreeHighlight, string> = {
  cor: "Na cor de destaque",
  marca: "Marca-texto",
  negrito: "Só negrito",
  caneta: "Caneta marca-texto (faixa clara atrás)",
  faixa: "Faixa sólida (texto branco)",
};

export const FREE_BACKGROUNDS = ["fundo", "destaque", "foto", "papel", "papel-destaque", "grao"] as const;
export type FreeBackground = (typeof FREE_BACKGROUNDS)[number];
export const FREE_BACKGROUND_LABELS: Record<FreeBackground, string> = {
  fundo: "Cor de fundo",
  destaque: "Cor de destaque",
  foto: "Foto",
  papel: "Papel amassado",
  "papel-destaque": "Papel no tom do destaque",
  grao: "Escuro com grão",
};

// ---------- Texturas (SVG puro, sem imagem: funcionam no preview e no renderizador) ----------

const svgUrl = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`;

/** Papel amassado: ruído iluminado de lado (vincos) multiplicado sobre a cor, mais um grão fino. */
function paperCss(base: string, width: number, height: number): string {
  const crumple = svgUrl(
    width,
    height,
    "<filter id='c' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='0.006 0.008' numOctaves='4' seed='11'/>" +
      "<feDiffuseLighting lighting-color='#fff' surfaceScale='9' diffuseConstant='1'><feDistantLight azimuth='225' elevation='45'/></feDiffuseLighting>" +
      "<feComponentTransfer><feFuncR type='linear' slope='0.38' intercept='0.68'/><feFuncG type='linear' slope='0.38' intercept='0.68'/><feFuncB type='linear' slope='0.38' intercept='0.68'/></feComponentTransfer>" +
      "</filter><rect width='100%' height='100%' filter='url(#c)'/>",
  );
  const grain = svgUrl(
    300,
    300,
    "<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.10 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/>",
  );
  return `background-color:${base};background-image:${grain},${crumple};background-size:300px 300px,100% 100%;background-blend-mode:normal,multiply;`;
}

/** Fundo escuro com grão claro e um leve vinhetado. */
function grainCss(base: string): string {
  const grain = svgUrl(
    300,
    300,
    "<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='5' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0'/></filter><rect width='100%' height='100%' filter='url(#g)'/>",
  );
  return `background-color:${base};background-image:${grain},radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.06),rgba(0,0,0,.35) 75%);background-size:300px 300px,100% 100%;`;
}

/** Mistura duas cores hex (t = quanto de `a`). */
function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = p(a);
  const [br, bg, bb] = p(b);
  const m = (x: number, y: number) => Math.round(x * t + y * (1 - t)).toString(16).padStart(2, "0");
  return `#${m(ar, br)}${m(ag, bg)}${m(ab, bb)}`;
}
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
  images?: (string | null | undefined)[];
  gap?: number;
  /** Fonte própria do elemento (sem ela: título usa a fonte dos títulos do estilo; texto, a do corpo). */
  family?: TitleFontId | "corpo";
  italic?: boolean;
  /** Sombra no texto, para ler bem sobre foto. */
  shadow?: boolean;
  /** Perfil: estilo e selo de verificado. */
  variant?: FreeProfileVariant;
  verified?: boolean;
  /** Ícone (elemento Ícone). */
  icon?: IconId;
  /** Fundo da etiqueta ou do cartão. */
  fill?: FreeColor | "vidro";
  radius?: number;
  /** Imagem como recorte (colagem): inteira, sem moldura, com o fundo claro da imagem sumindo no papel. */
  cutout?: boolean;
  /** Escurece a foto (imagem ou grade) em %, para o texto branco por cima ler bem. */
  dim?: number;
  /** Print de conversa: estilo, nome do contato (sem ele, o nome do cliente) e horário. */
  chat?: FreeChatStyle;
  contact?: string;
  time?: string;
}

export interface FreeSlide {
  bg: (typeof FREE_BACKGROUNDS)[number];
  overlay: (typeof FREE_OVERLAYS)[number];
  /** Barrinhas de progresso no topo (estilo story). */
  progress?: boolean;
  /** Modelo de origem (para variar o design e aplicar em lote sem perder o tipo da tela). */
  preset?: string | null;
  /** Carrossel infinito: a foto de fundo ocupa `total` slides lado a lado e este mostra o pedaço `part`. */
  pan?: { total: number; part: number } | null;
  elements: FreeElement[];
}

const clamp = (n: number | undefined, min: number, max: number, fallback: number) =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, n as number)) : fallback;

/** Selo de verificado (círculo azul com check), desenhado aqui para não depender de marca de terceiros. */
const VERIFIED_SVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="currentColor"/><path d="M7 12.5l3.2 3.2L17.5 8.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const OVERLAY_CSS: Record<FreeSlide["overlay"], string> = {
  nenhuma: "transparent",
  suave: "linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.55) 100%)",
  base: "linear-gradient(180deg,rgba(0,0,0,0) 30%,rgba(0,0,0,.6) 62%,rgba(0,0,0,.92) 100%)",
  forte: "linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,.55) 45%,rgba(0,0,0,.95) 100%)",
  total: "rgba(0,0,0,.55)",
};

// ---------- Print de conversa ----------

const CHAT_THEMES = {
  escuro: { wall: "#0B141A", dots: "rgba(255,255,255,.035)", bar: "#1F2C34", barInk: "#E9EDEF", sub: "#8696A0", them: "#202C33", me: "#005C4B", ink: "#E9EDEF", time: "rgba(233,237,239,.6)", tick: "#53BDEB" },
  claro: { wall: "#EFEAE2", dots: "rgba(0,0,0,.045)", bar: "#F0F2F5", barInk: "#111B21", sub: "#667781", them: "#FFFFFF", me: "#D9FDD3", ink: "#111B21", time: "rgba(17,27,33,.5)", tick: "#53BDEB" },
} as const;

const TICKS_SVG =
  '<svg viewBox="0 0 18 11" xmlns="http://www.w3.org/2000/svg"><path d="M1 6l3.2 3.2L11 2.4M7.4 8.6l.6.6L14.8 2.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BACK_SVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const BUBBLE_SVG =
  '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" fill="currentColor"/></svg>';

const CHAT_CSS = `
.chat{position:absolute;overflow:hidden;display:flex;flex-direction:column;font-family:"Inter",Arial,sans-serif;box-shadow:0 30px 70px rgba(0,0,0,.28)}
.chat-bar{display:flex;align-items:center;gap:.55em;padding:.55em .8em;flex-shrink:0}
.chat-bar .back{width:1.1em;height:1.1em;display:inline-flex;opacity:.9}
.chat-bar .back svg,.n-ico svg{width:100%;height:100%}
.chat-av{border-radius:50%;object-fit:cover;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;font-weight:700}
.chat-who{display:flex;flex-direction:column;line-height:1.15}
.chat-who b{font-weight:600}
.chat-who small{font-size:.72em}
.chat-body{flex:1;display:flex;flex-direction:column;justify-content:flex-end;gap:.38em;padding:.6em .8em .9em}
.bub{max-width:80%;padding:.42em .62em .32em;border-radius:.55em;line-height:1.32;box-shadow:0 1px .5px rgba(0,0,0,.13);overflow-wrap:break-word}
.bub.them{align-self:flex-start;border-top-left-radius:.12em}
.bub.me{align-self:flex-end;border-top-right-radius:.12em}
.bub .meta{display:flex;justify-content:flex-end;align-items:center;gap:.25em;font-size:.6em;margin-top:.15em;white-space:nowrap}
.bub .meta i{display:inline-flex;width:1.35em;height:.85em}
.bub .meta i svg{width:100%;height:100%}
.bub strong{font-weight:700}
.lock{position:absolute;display:flex;flex-direction:column;align-items:stretch;gap:.5em;font-family:"Inter",Arial,sans-serif;color:#fff}
.lock-clock{text-align:center;font-weight:300;line-height:1;letter-spacing:-.02em}
.notif{display:flex;gap:.6em;align-items:flex-start;padding:.62em .7em;border-radius:.9em;background:rgba(245,245,247,.78);color:#111;box-shadow:0 10px 30px rgba(0,0,0,.16);backdrop-filter:blur(18px)}
.notif.dark{background:rgba(28,28,32,.72);color:#fff}
.notif .n-ico{width:1.9em;height:1.9em;border-radius:.45em;flex-shrink:0;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;padding:.35em}
.notif .n-ico.img{padding:0}
.notif .n-ico img{width:100%;height:100%;object-fit:cover}
.notif .n-main{flex:1;min-width:0;line-height:1.28}
.notif .n-top{display:flex;justify-content:space-between;gap:.6em}
.notif .n-top b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.notif .n-top small{opacity:.6;font-size:.82em;white-space:nowrap}
.notif strong{font-weight:700}
`;

function renderChat(
  el: FreeElement,
  ctx: { box: string; h: number; size: number; brandName: string; logo: string | null; accent: string; ink: string; fillTokens: (t: string) => string },
): string {
  const style: FreeChatStyle = (FREE_CHAT_STYLES as readonly string[]).includes(el.chat ?? "") ? (el.chat as FreeChatStyle) : "escuro";
  const contact = escapeHtml((el.contact ?? "").trim() || ctx.brandName || "Contato");
  const time = /^\d{1,2}:\d{2}$/.test((el.time ?? "").trim()) ? (el.time as string).trim() : "09:41";
  const messages = parseChatMessages(ctx.fillTokens(el.text ?? ""));
  const radius = clamp(el.radius, 0, 120, 36);
  const avatar = (px: number) =>
    ctx.logo
      ? `<img class="chat-av" src="${ctx.logo}" alt="" style="width:${px}px;height:${px}px"/>`
      : `<span class="chat-av" style="width:${px}px;height:${px}px;font-size:${Math.round(px * 0.4)}px;background:${ctx.accent};color:${contrastText(ctx.accent)}">${escapeHtml(initials(contact))}</span>`;

  if (style === "notificacoes") {
    const dark = el.fill === "preto";
    const icon = ctx.logo
      ? `<span class="n-ico img"><img src="${ctx.logo}" alt=""/></span>`
      : `<span class="n-ico" style="background:${ctx.accent};color:${contrastText(ctx.accent)}">${BUBBLE_SVG}</span>`;
    // Mais recente em cima, como na tela bloqueada.
    const cards = messages
      .slice(0, 6)
      .map(
        (m, i) =>
          `<div class="notif${dark ? " dark" : ""}">${icon}<div class="n-main"><div class="n-top"><b>${m.mine ? "Você" : contact}</b><small>${NOTIFICATION_AGES[i] ?? "1 h"}</small></div><div>${formatRichText(m.text)}</div></div></div>`,
      )
      .join("");
    // O relógio grande só aparece quando o horário foi preenchido.
    const clock = (el.time ?? "").trim() ? `<div class="lock-clock" style="font-size:${(ctx.size * 3.4).toFixed(0)}px;margin-bottom:.25em">${time}</div>` : "";
    // Relógio na cor do texto do slide: branco sobre foto, escuro sobre fundo claro.
    return `<div class="lock" style="${ctx.box}font-size:${ctx.size}px;color:${ctx.ink}">${clock}${cards}</div>`;
  }

  const t = CHAT_THEMES[style];
  let minute = 0;
  const bubbles = messages
    .map((m, i) => {
      // O relógio anda um pouco a cada duas mensagens.
      if (i > 0 && i % 2 === 0) minute += 1;
      const meta = `<span class="meta" style="color:${t.time}">${addMinutes(time, minute)}${m.mine ? `<i style="color:${t.tick}">${TICKS_SVG}</i>` : ""}</span>`;
      return `<div class="bub ${m.mine ? "me" : "them"}" style="background:${m.mine ? t.me : t.them};color:${t.ink}">${formatRichText(m.text)}${meta}</div>`;
    })
    .join("");
  const wall = `background-color:${t.wall};background-image:radial-gradient(${t.dots} 1.2px,transparent 1.3px);background-size:22px 22px;`;
  const barAvatar = Math.round(ctx.size * 1.6);
  // A altura é o máximo: com poucas mensagens a caixa encolhe (sem vazio em cima).
  return `<div class="chat" style="${ctx.box}max-height:${ctx.h}%;border-radius:${radius}px;font-size:${ctx.size}px;${wall}"><div class="chat-bar" style="background:${t.bar};color:${t.barInk}"><span class="back">${BACK_SVG}</span>${avatar(barAvatar)}<span class="chat-who"><b>${contact}</b><small style="color:${t.sub}">online</small></span></div><div class="chat-body">${bubbles}</div></div>`;
}

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

  const paperTint = mixHex(accent.length === 7 ? accent : "#4F46E5", "#FFFFFF", 0.38);
  const darkBase = contrastRatio(bg, "#FFFFFF") > 7 ? bg : "#141414";
  const pageBg =
    free.bg === "destaque" ? accent : photo ? "#000000" : free.bg === "papel-destaque" ? paperTint : free.bg === "grao" ? darkBase : bg;
  // Cor "texto" se adapta ao fundo: sobre foto ou destaque fica legível sozinha.
  const autoText = photo ? "#FFFFFF" : free.bg === "destaque" ? onAccent : free.bg === "grao" ? "#F5F5F4" : text;
  const textureCss =
    free.bg === "papel" || free.bg === "papel-destaque"
      ? paperCss(pageBg, width, height)
      : free.bg === "grao"
        ? grainCss(pageBg)
        : "";
  const colorOf = (c: FreeColor | undefined, fallback: string) =>
    c === "fundo" ? bg : c === "destaque" ? accent : c === "branco" ? "#FFFFFF" : c === "preto" ? "#0B0B0C" : c === "texto" ? autoText : fallback;

  // Sobre fundo na cor de destaque, o destaque das palavras usa a cor de fundo (senão some).
  // Escolhe entre a cor do texto e a de fundo a que mais se diferencia do texto branco/preto do destaque.
  const hlColor =
    free.bg === "destaque" && !photo
      ? [text, bg].sort((a, b) => contrastRatio(b, onAccent) - contrastRatio(a, onAccent))[0]
      : free.bg === "papel-destaque"
        ? text
        : accent;
  /** Faixa sólida: o destaque escurecido até o texto branco ficar legível em cima dele. */
  let bandColor = accent.length === 7 ? accent : "#4F46E5";
  for (let t = 0.95; contrastRatio(bandColor, "#FFFFFF") < 3.2 && t > 0.5; t -= 0.05) bandColor = mixHex(accent.length === 7 ? accent : "#4F46E5", "#000000", t);
  /** Caneta marca-texto: faixa clara da cor de destaque atrás das palavras (o texto continua na cor dele). */
  const penColor = free.bg === "grao" ? mixHex(accent.length === 7 ? accent : "#4F46E5", "#000000", 0.75) : mixHex(accent.length === 7 ? accent : "#4F46E5", "#FFFFFF", 0.62);
  const glass = photo ? "rgba(255,255,255,.16)" : `color-mix(in srgb,${autoText} 12%,transparent)`;
  const logoSrc = safeImageSrc(brand.logo);
  const handle = brand.handle.trim().replace(/^@+/, "");
  /** {nome}, {usuario}, {n} e {total} no texto viram o nome, o @ e a numeração do slide. */
  const fillTokens = (text: string) =>
    text
      .replace(/\{nome\}/g, brand.name.trim())
      .replace(/\{usuario\}/g, handle ? `@${handle}` : "")
      .replace(/\{n\}/g, String(index + 1))
      .replace(/\{total\}/g, String(total));

  const elements = free.elements.slice(0, 40).map((el) => {
    const x = clamp(el.x, -20, 100, 8);
    const y = clamp(el.y, -20, 100, 8);
    const w = clamp(el.w, 2, 140, 80);
    const h = clamp(el.h, 0.1, 140, 20);
    const size = clamp(el.size, 10, 400, 40);
    const align = el.align === "center" || el.align === "right" ? el.align : "left";
    const color = colorOf(el.color, autoText);
    const box = `left:${x}%;top:${y}%;width:${w}%;text-align:${align};`;
    const highlight =
      el.highlight === "marca"
        ? " hl-marca"
        : el.highlight === "negrito"
          ? " hl-negrito"
          : el.highlight === "caneta"
            ? " hl-caneta"
            : el.highlight === "faixa"
              ? " hl-faixa"
              : " hl-cor";
    const upper = el.upper ? "text-transform:uppercase;" : "";
    const family =
      el.family && el.family !== "corpo" && TITLE_FONTS[el.family]
        ? TITLE_FONTS[el.family]
        : el.family === "corpo"
          ? null
          : el.font === "titulo" || (!el.font && el.kind === "titulo")
            ? font
            : null;
    const fontStyle = (
      (family
        ? `font-family:${family.stack};font-weight:${family.weight};line-height:${el.kind === "texto" ? 1.32 : family.uppercase ? 1 : 1.06};letter-spacing:${family.tracking};${family.uppercase ? "text-transform:uppercase;" : ""}`
        : `font-family:"Inter",Arial,sans-serif;font-weight:400;line-height:1.4;`) +
      (el.italic ? "font-style:italic;" : "") +
      (el.shadow ? "text-shadow:0 4px 24px rgba(0,0,0,.55);" : "")
    ).replace(/"/g, "'"); // vai dentro de style="...": aspas duplas na pilha de fontes cortariam o atributo
    const content = formatRichText(fillTokens(el.text ?? ""));

    switch (el.kind) {
      case "titulo":
      case "texto":
        return `<div class="el${highlight}" style="${box}font-size:${size}px;color:${color};${fontStyle}${upper}">${content}</div>`;
      case "etiqueta": {
        // "Vidro" sobre foto é branco translúcido; sobre fundo liso vira um tom do texto, para não sumir.
        const fill = el.fill === "vidro" ? glass : colorOf(el.fill as FreeColor | undefined, accent);
        const ink = el.color ? color : el.fill === "vidro" ? autoText : contrastText(fill.startsWith("#") ? fill : accent);
        return `<div class="el" style="${box}"><span class="tag" style="font-size:${size}px;background:${fill};color:${ink};${upper}">${content}</span></div>`;
      }
      case "perfil": {
        const variant = el.variant ?? "linha";
        const avatarSize = variant === "chip" ? size * 1.5 : variant === "tweet" ? size * 2.6 : size * 2;
        const logo = logoSrc
          ? `<img class="avatar" src="${logoSrc}" alt="" style="width:${avatarSize}px;height:${avatarSize}px"/>`
          : `<span class="avatar initials" style="width:${avatarSize}px;height:${avatarSize}px;font-size:${Math.round(avatarSize * 0.4)}px">${escapeHtml(initials(brand.name))}</span>`;
        const justify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
        const badge = el.verified ? `<span class="verified" style="width:${size * 0.95}px;height:${size * 0.95}px">${VERIFIED_SVG}</span>` : "";
        if (variant === "chip") {
          const fill = el.fill === "vidro" || !el.fill ? glass : colorOf(el.fill as FreeColor, accent);
          const ink = el.color && el.color !== "texto" ? color : fill.startsWith("#") ? contrastText(fill) : color;
          return `<div class="el" style="${box}display:flex;justify-content:${justify}"><span class="pchip" style="font-size:${size}px;background:${fill};color:${ink}">${logo}<b>${handle ? `@${escapeHtml(handle)}` : escapeHtml(brand.name.trim())}</b>${badge}</span></div>`;
        }
        return `<div class="el profile" style="${box}font-size:${size}px;color:${color};justify-content:${justify}">${logo}<span class="who"><b class="namerow">${escapeHtml(brand.name.trim())}${badge}</b>${handle ? `<small>@${escapeHtml(handle)}</small>` : ""}</span></div>`;
      }
      case "icone": {
        const svg = iconSvg(el.icon ?? "brilho", "ico");
        const fill = el.fill ? (el.fill === "vidro" ? glass : colorOf(el.fill as FreeColor, accent)) : null;
        const ink = el.color ? color : fill && fill.startsWith("#") ? contrastText(fill) : accent;
        const wrap = fill ? `background:${fill};border-radius:50%;padding:${Math.round(size * 0.28)}px;` : "";
        return `<div class="el" style="${box}display:flex;justify-content:${align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start"}"><span style="display:inline-flex;${wrap}color:${ink};width:${size}px;height:${size}px;box-sizing:content-box">${svg}</span></div>`;
      }
      case "arraste":
        return `<div class="el t-body" style="${box}font-size:${size}px;color:${color};opacity:.85">${content || "Arraste →"}</div>`;
      case "numeracao":
        return `<div class="el t-body" style="${box}font-size:${size}px;color:${color};opacity:.7">${index + 1}/${total}</div>`;
      case "imagem": {
        const src = safeImageSrc(el.image);
        const radius = clamp(el.radius, 0, 200, 24);
        if (src && el.cutout) {
          // Recorte de colagem: imagem inteira; "multiply" faz o fundo claro dela sumir no papel. O filtro leva o
          // "quase branco" do fundo da imagem a branco puro (senão sobra um retângulo um pouco mais escuro).
          return `<div class="el" style="${box}height:${h}%"><img src="${src}" alt="" style="width:100%;height:100%;object-fit:contain;object-position:center bottom;display:block;mix-blend-mode:multiply;filter:brightness(1.1) contrast(1.12)"/></div>`;
        }
        const dimLayer = el.dim ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,${clamp(el.dim, 0, 90, 0) / 100})"></div>` : "";
        return src
          ? `<div class="el" style="${box}height:${h}%;border-radius:${radius}px;overflow:hidden"><img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>${dimLayer}</div>`
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
            ? `<div style="border-radius:${radius}px;overflow:hidden;position:relative"><img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>${el.dim ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,${clamp(el.dim, 0, 90, 0) / 100})"></div>` : ""}</div>`
            : `<div class="img-empty" style="border-radius:${radius}px;position:static">Foto ${i + 1}</div>`;
        }).join("");
        return `<div class="el" style="${box}height:${h}%;display:grid;${template};gap:${gap}px">${cells}</div>`;
      }
      case "mancha": {
        // Mancha de tinta: forma orgânica com a borda "comida" por ruído (como tinta em papel).
        const fill = colorOf(el.fill as FreeColor | undefined, accent);
        const seed = [...el.id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) % 997, 7);
        const fid = `m${seed}${Math.round(x * 10)}${Math.round(y * 10)}`;
        return `<div class="el" style="${box}height:${h}%"><svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style="display:block;overflow:visible"><filter id="${fid}" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="7"/></filter><path d="M18,34 C22,10 52,2 74,10 C94,18 100,46 90,68 C80,90 50,100 26,92 C6,85 2,62 10,48 C13,42 16,40 18,34Z" fill="${fill}" filter="url(#${fid})"/></svg></div>`;
      }
      case "conversa":
        return renderChat(el, { box, h, size, brandName: brand.name.trim(), logo: logoSrc, accent, ink: autoText, fillTokens });
      case "cartao": {
        const fill = el.fill === "vidro" ? glass : colorOf(el.fill as FreeColor | undefined, "#FFFFFF");
        const radius = clamp(el.radius, 0, 200, 36);
        // Linha fina (divisória) não leva sombra.
        const shadow = h < 2 ? "" : "box-shadow:0 30px 60px rgba(0,0,0,.18)";
        return `<div class="el" style="${box}height:${h}%;border-radius:${radius}px;background:${fill};${shadow}"></div>`;
      }
    }
  });

  const progress = free.progress && total > 1
    ? `<div class="progress">${Array.from({ length: total }, (_, i) => `<span class="${i <= index ? "on" : ""}"></span>`).join("")}</div>`
    : "";

  const css = `
body{background:${pageBg};color:${autoText};font-family:"Inter",Arial,sans-serif}
.root{position:relative;width:${width}px;height:${height}px;overflow:hidden;${textureCss}}
.photo{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;max-width:none}
.shade{position:absolute;inset:0;background:${photo ? OVERLAY_CSS[free.overlay] ?? "transparent" : "transparent"}}
.el{position:absolute;overflow-wrap:break-word}
.t-body{font-family:"Inter",Arial,sans-serif;line-height:1.4}
strong{font-weight:700}
.hl-cor strong{color:${hlColor}}
.hl-negrito strong{font-weight:800}
.hl-faixa strong{font-weight:inherit;background:${bandColor};color:#FFFFFF;padding:.04em .2em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.hl-caneta strong{font-weight:inherit;background:linear-gradient(transparent 18%,${penColor} 18%,${penColor} 92%,transparent 92%);padding:0 .12em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.hl-marca strong{background:${hlColor};color:${contrastText(hlColor)};padding:0 .14em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.tag{display:inline-block;padding:.45em 1.1em;border-radius:999px;font-weight:700;letter-spacing:.04em;line-height:1.2}
.profile{display:flex;align-items:center;gap:.7em}
.avatar{border-radius:50%;object-fit:cover;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${accent};color:${onAccent};font-weight:700}
.who{display:flex;flex-direction:column;line-height:1.2}
.who b{font-weight:700}
.who small{font-size:.8em;opacity:.75}
.namerow{display:inline-flex;align-items:center;gap:.3em}
.verified{display:inline-flex;color:#1D9BF0}
.verified svg{width:100%;height:100%}
.pchip{display:inline-flex;align-items:center;gap:.45em;padding:.3em .9em .3em .3em;border-radius:999px;font-weight:600}
.ico{width:100%;height:100%;stroke-width:2.2}
.img-empty{display:flex;align-items:center;justify-content:center;background:color-mix(in srgb,${autoText} 10%,transparent);border:3px dashed color-mix(in srgb,${autoText} 35%,transparent);color:color-mix(in srgb,${autoText} 55%,transparent);font-size:32px}
${CHAT_CSS}
.progress{position:absolute;left:4%;right:4%;top:2.4%;display:flex;gap:10px}
.progress span{flex:1;height:6px;border-radius:3px;background:${photo ? "rgba(255,255,255,.35)" : `color-mix(in srgb,${autoText} 18%,transparent)`}}
.progress span.on{background:${photo ? "rgba(255,255,255,.95)" : autoText}}
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
    icone: { x: 8, y: 20, w: 12, size: 72, icon: "brilho" },
    mancha: { x: 10, y: 50, w: 60, h: 36, fill: "destaque" },
    conversa: { x: 8, y: 22, w: 84, h: 62, size: 32, chat: "escuro", text: "Oi! Posso te fazer uma pergunta?\nEu: Claro, pode mandar!" },
  };
  return { id: newElementId(), kind, ...base[kind], ...over } as FreeElement;
}

export interface FreePresetInput {
  title: string;
  body: string;
  hasImage: boolean;
}

export type FreePresetCategory = "capa" | "interno" | "final";

export interface FreePreset {
  id: string;
  label: string;
  category: FreePresetCategory;
  /** Pede foto de fundo (sem foto, o modelo usa a cor de fundo). */
  photo?: boolean;
  build: (input: FreePresetInput) => FreeSlide;
}

export const FREE_PRESET_CATEGORIES: { id: FreePresetCategory; label: string }[] = [
  { id: "capa", label: "Capas" },
  { id: "interno", label: "Telas internas" },
  { id: "final", label: "Fechamento" },
];

const el = newFreeElement;
/** Textos de exemplo só quando o slide está vazio; quem monta a partir de conteúdo (assistente) desliga. */
let usePlaceholders = true;
const ph = (value: string, placeholder: string) => value || (usePlaceholders ? placeholder : "");
const firstLine = (text: string, fallback: string) => ph((text.split("\n").find((l) => l.trim()) ?? "").trim().slice(0, 60), fallback);
const lines = (text: string, fallback: string[], max: number) => {
  const list = text.split("\n").map((l) => l.replace(/^[-•→\d.)\s]+/, "").trim()).filter(Boolean);
  return (list.length ? list : usePlaceholders ? fallback : []).slice(0, max);
};
/** Mensagens do Print de conversa: as linhas do texto (com "Eu:" para a resposta) ou o exemplo. */
const chatText = (text: string, fallback: string[]) => {
  const list = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (list.length ? list : usePlaceholders ? fallback : []).slice(0, 8).join("\n");
};
/** Rodapé padrão: perfil à esquerda e "Arraste →" à direita. */
const footer = (y = 90): FreeElement[] => [el("perfil", { x: 8, y, w: 55, size: 24 }), el("arraste", { x: 62, y: y + 1.5, w: 30, size: 22 })];
const photoBg = (hasImage: boolean, overlay: FreeSlide["overlay"]): Pick<FreeSlide, "bg" | "overlay"> => ({ bg: hasImage ? "foto" : "fundo", overlay });

/** Título inteiro na caneta marca-texto (quando o texto ainda não marca palavras com **). */
const penAll = (text: string) => (!text.trim() || text.includes("**") ? text : `**${text.trim()}**`);
/**
 * Maior tamanho de fonte (até `base`) em que o texto cabe na caixa, por estimativa: largura média
 * de caractere `charEm` (em "em") e entrelinha `lineH`. Os modelos têm posições fixas, então um título
 * longo precisa encolher para não invadir o elemento de baixo. Caixa em % de 1080×1350.
 */
export function fitFontSize(text: string, base: number, boxW: number, boxH: number, charEm: number, lineH: number, min = 36): number {
  const plain = text.replace(/\*\*/g, "").trim();
  if (!plain) return base;
  const widthPx = (boxW / 100) * 1080;
  const heightPx = (boxH / 100) * 1350;
  for (let size = base; size > min; size -= 2) {
    const perLine = Math.max(1, Math.floor(widthPx / (size * charEm)));
    // Quebra por palavra: conta linhas encaixando palavra por palavra.
    let lines = 1;
    let used = 0;
    for (const word of plain.split(/\s+/)) {
      const len = word.length;
      if (used && used + 1 + len > perLine) {
        lines++;
        used = len;
      } else used += (used ? 1 : 0) + len;
    }
    if (lines * size * lineH <= heightPx) return size;
  }
  return min;
}

/** @ do cliente pequeno, centralizado no rodapé, na cor de destaque. */
const handleFooter = (y = 94): FreeElement => el("texto", { x: 15, y, w: 70, size: 20, align: "center", color: "destaque", text: "{usuario}" });

export const FREE_PRESETS: FreePreset[] = [
  // ---------- Capas ----------
  {
    id: "capa-revista",
    label: "Revista",
    category: "capa",
    photo: true,
    build: ({ title, body, hasImage }) => ({
      ...photoBg(hasImage, "base"),
      elements: [
        el("etiqueta", { x: 8, y: 52, w: 84, text: firstLine(body, "TEMA DO POST"), fill: hasImage ? "vidro" : "destaque" }),
        el("titulo", { x: 8, y: 58, w: 84, size: 104, text: ph(title, "Título **forte** para a capa"), upper: true, highlight: "cor" }),
        ...footer(),
      ],
    }),
  },
  {
    id: "capa-marca-texto",
    label: "Marca-texto",
    category: "capa",
    photo: true,
    build: ({ title, hasImage }) => ({
      ...photoBg(hasImage, "forte"),
      elements: [
        el("titulo", { x: 8, y: 56, w: 84, size: 100, text: ph(title, "O **futuro** do seu **negócio** começa aqui"), upper: true, highlight: "marca" }),
        ...footer(),
      ],
    }),
  },
  {
    id: "capa-editorial",
    label: "Editorial serifado",
    category: "capa",
    photo: true,
    build: ({ title, body, hasImage }) => ({
      ...photoBg(hasImage, "suave"),
      elements: [
        el("titulo", { x: 7, y: 62, w: 80, size: 132, text: ph(title, "Yoga para **mães**"), family: "serif", italic: true, upper: true, highlight: "negrito", shadow: hasImage }),
        el("texto", { x: 7.5, y: 86, w: 75, size: 30, text: firstLine(body, "Transforme sua rotina com estes 3 passos."), shadow: hasImage }),
      ],
    }),
  },
  {
    id: "capa-chip-central",
    label: "Centro com etiqueta",
    category: "capa",
    photo: true,
    build: ({ title, body, hasImage }) => ({
      ...photoBg(hasImage, "forte"),
      progress: false,
      elements: [
        el("titulo", { x: 7, y: 56, w: 86, size: 78, text: ph(title, "Transforme seu **corpo** com o treino certo"), upper: true, align: "center", family: "geometric", highlight: "cor" }),
        el("etiqueta", { x: 10, y: 83, w: 80, size: 22, align: "center", text: firstLine(body, "GUIA COMPLETO"), fill: "preto", upper: true }),
        el("texto", { x: 7, y: 93, w: 30, size: 20, text: "{nome}" }),
        el("texto", { x: 63, y: 93, w: 30, size: 20, align: "right", text: "{usuario}" }),
      ],
    }),
  },
  {
    id: "capa-impacto",
    label: "Impacto condensado",
    category: "capa",
    photo: true,
    build: ({ title, hasImage }) => ({
      ...photoBg(hasImage, "forte"),
      elements: [
        el("titulo", { x: 6, y: 50, w: 88, size: 136, text: ph(title, "Destrave seus **resultados** agora"), family: "display", align: "center", highlight: "cor", shadow: hasImage }),
        el("texto", { x: 6, y: 94, w: 28, size: 18, text: "{nome}", upper: true }),
        el("texto", { x: 36, y: 94, w: 28, size: 18, align: "center", text: "Arraste →", upper: true }),
        el("texto", { x: 66, y: 94, w: 28, size: 18, align: "right", text: "{usuario}" }),
      ],
    }),
  },
  {
    id: "capa-perfil-chip",
    label: "Perfil + título gigante",
    category: "capa",
    photo: true,
    build: ({ title, body, hasImage }) => ({
      ...photoBg(hasImage, "base"),
      elements: [
        el("perfil", { x: 7, y: 60, w: 70, size: 26, variant: "chip" }),
        el("titulo", { x: 7, y: 66, w: 86, size: 128, text: ph(title, "Claude Fable 5"), highlight: "cor" }),
        el("texto", { x: 7, y: 84, w: 82, size: 38, text: firstLine(body, "O que mudou e como usar a partir de hoje.") }),
      ],
    }),
  },
  {
    id: "capa-tiras",
    label: "2 tiras de foto",
    category: "capa",
    build: ({ title }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("grade", { x: 0, y: 0, w: 100, h: 60, grid: "2v", gap: 8, radius: 0 }),
        el("titulo", { x: 8, y: 64, w: 84, size: 92, text: ph(title, "Antes e **depois** em 30 dias"), upper: true }),
        ...footer(),
      ],
    }),
  },
  {
    id: "capa-3-tiras",
    label: "3 tiras de foto",
    category: "capa",
    build: ({ title }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("grade", { x: 4, y: 4, w: 92, h: 56, grid: "3v", gap: 12, radius: 24 }),
        el("titulo", { x: 8, y: 64, w: 84, size: 88, text: ph(title, "3 **formas** de começar hoje"), upper: true }),
        ...footer(),
      ],
    }),
  },
  {
    id: "capa-tweet",
    label: "Post estilo tweet",
    category: "capa",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("perfil", { x: 10, y: 20, w: 80, size: 30, variant: "tweet", verified: true }),
        el("texto", { x: 10, y: 31, w: 80, size: 44, text: [ph(title, "Você ainda perde horas fazendo isso na mão?"), body].filter(Boolean).join("\n") }),
        el("imagem", { x: 10, y: 58, w: 80, h: 28, radius: 28 }),
      ],
    }),
  },
  // ---------- Colagem editorial (papel, máquina de escrever, recortes retrô) ----------
  {
    id: "colagem-capa",
    label: "Colagem: capa",
    category: "capa",
    // Mais peso que as telas internas: título enorme, linha de apoio em faixa sólida e mancha de tinta
    // atrás da figura recortada (como a capa "7 coisas xexelentas" da Sabrina).
    build: ({ title, body }) => ({
      bg: "papel",
      overlay: "nenhuma",
      elements: [
        el("mancha", { x: -8, y: 58, w: 74, h: 46, fill: "destaque" }),
        el("imagem", { x: 22, y: 42, w: 80, h: 58, cutout: true }),
        el("titulo", {
          x: 6,
          y: 5,
          w: 88,
          // Montserrat 800: ~0,62 em por caractere; espaço até a linha de apoio.
          size: fitFontSize(ph(title, "**7 coisas** que travam o seu marketing"), 136, 88, 29, 0.62, 1.02),
          family: "geometric",
          highlight: "caneta",
          text: ph(title, "**7 coisas** que travam o seu marketing"),
        }),
        el("texto", { x: 6, y: 36, w: 84, size: 52, family: "maquina", highlight: "faixa", text: penAll(ph(body, "que você não deveria reproduzir")) }),
        el("texto", { x: 15, y: 95, w: 70, size: 20, align: "center", color: "branco", text: "{usuario}", shadow: true }),
      ],
    }),
  },
  // ---------- Foto documental (fotos reais do cotidiano, escurecidas, frase branca) ----------
  {
    id: "doc-capa",
    label: "Documental: capa",
    category: "capa",
    photo: true,
    build: ({ title, body, hasImage }) => ({
      ...photoBg(hasImage, "forte"),
      elements: [
        el("texto", { x: 10, y: 33, w: 80, size: 30, align: "center", upper: true, text: ph(body, "Crenças procrastinadoras ×") }),
        el("titulo", {
          x: 6,
          y: 39,
          w: 88,
          // Marcador: ~0,62 em por caractere, caixa alta; até perto do rodapé.
          size: fitFontSize(ph(title, "Crenças na bala"), 124, 88, 34, 0.66, 1.05),
          family: "marcador",
          align: "center",
          highlight: "cor",
          text: ph(title, "Crenças na bala"),
          shadow: true,
        }),
        el("texto", { x: 15, y: 94, w: 70, size: 20, align: "center", color: "branco", text: "{usuario}" }),
      ],
    }),
  },
  {
    id: "capa-conversa",
    label: "Print de conversa",
    category: "capa",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("titulo", { x: 8, y: 6, w: 84, size: 72, text: ph(title, "Ela me mandou isso **ontem**") }),
        el("conversa", {
          x: 8,
          y: 25,
          w: 84,
          h: 64,
          size: 38,
          chat: "escuro",
          time: "21:14",
          text: chatText(body, ["Oi! Desculpa o horário", "Testei o que você ensinou no post e **funcionou**", "Eu: Que demais! Me conta como foi?", "Em uma semana já vi diferença"]),
        }),
        el("arraste", { x: 62, y: 91, w: 30, size: 22 }),
      ],
    }),
  },
  {
    id: "capa-notificacoes",
    label: "Notificações",
    category: "capa",
    photo: true,
    build: ({ title, body, hasImage }) => ({
      ...photoBg(hasImage, "suave"),
      elements: [
        el("conversa", {
          x: 7,
          y: 5,
          w: 86,
          h: 54,
          size: 34,
          chat: "notificacoes",
          time: "09:41",
          text: chatText(body, ["Preciso falar com você sobre aquele post", "Fiz o passo 2 e mudou tudo aqui", "Você vai abrir vaga de novo?"]),
        }),
        el("titulo", { x: 8, y: 66, w: 84, size: 84, upper: true, text: ph(title, "Isso chegou **hoje** cedo"), shadow: hasImage }),
        ...footer(),
      ],
    }),
  },
  {
    id: "capa-manchete",
    label: "Manchete de jornal",
    category: "capa",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("texto", { x: 6, y: 4.5, w: 88, size: 20, align: "center", upper: true, text: "Edição especial · {nome}" }),
        el("cartao", { x: 6, y: 9, w: 88, h: 0.5, radius: 0, fill: "texto" }),
        el("titulo", { x: 6, y: 12, w: 88, size: 104, align: "center", family: "serif", text: ph(title, "A **notícia** que ninguém te contou") }),
        el("imagem", { x: 6, y: 47, w: 88, h: 36, radius: 0 }),
        el("texto", { x: 6, y: 85, w: 88, size: 26, align: "center", italic: true, text: firstLine(body, "Leia até o fim antes de decidir.") }),
        el("cartao", { x: 6, y: 92, w: 88, h: 0.5, radius: 0, fill: "texto" }),
        el("texto", { x: 6, y: 94, w: 88, size: 18, align: "center", upper: true, text: "{usuario} · Arraste →" }),
      ],
    }),
  },
  {
    id: "capa-numero",
    label: "Número gigante",
    category: "capa",
    build: ({ title }) => ({
      bg: "destaque",
      overlay: "nenhuma",
      elements: [
        el("titulo", { x: 5, y: 2, w: 90, size: 560, family: "display", text: ph(title.match(/\d+/)?.[0] ?? "", "7").slice(0, 3) }),
        el("titulo", { x: 8, y: 62, w: 84, size: 84, upper: true, text: ph(title, "7 **erros** que travam suas vendas") }),
        ...footer(),
      ],
    }),
  },
  {
    id: "capa-pergunta",
    label: "Pergunta provocativa",
    category: "capa",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("titulo", { x: 56, y: 2, w: 50, size: 640, family: "serif", color: "destaque", text: "?" }),
        el("etiqueta", { x: 8, y: 40, w: 60, size: 24, text: firstLine(body, "VOCÊ SABIA?"), fill: "destaque" }),
        el("titulo", { x: 8, y: 47, w: 80, size: 96, text: ph(title, "Por que seu **post** não engaja?") }),
        ...footer(),
      ],
    }),
  },

  // ---------- Telas internas ----------
  {
    id: "interno-texto",
    label: "Título + texto",
    category: "interno",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("perfil", { x: 8, y: 30, w: 70, size: 26, variant: "chip" }),
        el("titulo", { x: 8, y: 38, w: 84, size: 72, text: ph(title, "O mito se torna **realidade**"), upper: true }),
        el("texto", { x: 8, y: 56, w: 84, size: 36, text: ph(body, "Texto de apoio do slide, direto ao ponto.") }),
        el("numeracao", { x: 80, y: 92, w: 12, size: 22 }),
      ],
    }),
  },
  {
    id: "interno-cartao",
    label: "Cartão branco",
    category: "interno",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("cartao", { x: 6, y: 8, w: 88, h: 78, fill: "branco" }),
        el("etiqueta", { x: 12, y: 13, w: 76, size: 22, text: "DESTAQUE", fill: "destaque" }),
        el("titulo", { x: 12, y: 20, w: 76, size: 64, text: ph(title, "Chega de **conteúdo** sem resultado"), color: "preto", upper: true }),
        el("texto", { x: 12, y: 42, w: 76, size: 32, text: ph(body, "Explique aqui a ideia principal deste slide em duas ou três frases curtas."), color: "preto" }),
        ...footer(),
      ],
    }),
  },
  {
    id: "interno-cartao-foto",
    label: "Cartão com foto",
    category: "interno",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("cartao", { x: 6, y: 6, w: 88, h: 82, fill: "branco" }),
        el("etiqueta", { x: 11, y: 10.5, w: 78, size: 20, text: "✦ O DESAFIO", fill: "destaque" }),
        el("titulo", { x: 11, y: 17, w: 78, size: 56, color: "preto", upper: true, text: ph(title, "Chega de carrosséis sem **engajamento**") }),
        el("texto", { x: 11, y: 33, w: 78, size: 27, color: "preto", text: ph(body, "Conte o problema em duas frases e mostre a saída na imagem abaixo.") }),
        el("imagem", { x: 11, y: 55, w: 78, h: 29, radius: 22 }),
        ...footer(91),
      ],
    }),
  },
  {
    id: "interno-tweet",
    label: "Tweet com imagem",
    category: "interno",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("perfil", { x: 10, y: 18, w: 80, size: 28, variant: "tweet", verified: true }),
        el("texto", { x: 10, y: 28, w: 80, size: 38, text: ph([title, body].filter(Boolean).join("\n"), "Texto do post, como um tweet: direto e opinativo.") }),
        el("imagem", { x: 10, y: 56, w: 80, h: 30, radius: 26 }),
      ],
    }),
  },
  {
    id: "colagem-item",
    label: "Colagem: item",
    category: "interno",
    build: ({ title, body }) => ({
      bg: "papel",
      overlay: "nenhuma",
      elements: [
        el("titulo", {
          x: 8,
          y: 10,
          w: 84,
          // Cutive: ~0,5 em por caractere; espaço até o texto (y 30).
          size: fitFontSize(ph(title, "1. Inventar urgência para forçar uma compra."), 60, 84, 17, 0.53, 1.12),
          family: "maquina",
          highlight: "caneta",
          text: penAll(ph(title, "1. Inventar urgência para forçar uma compra.")),
        }),
        el("texto", {
          x: 9,
          y: 30,
          w: 52,
          size: 34,
          family: "maquina",
          text: ph(body, "“Últimas vagas” que nunca acabam.\n\nUrgência funciona. Mas quando ela é falsa, você treina o público a não acreditar em você."),
        }),
        el("imagem", { x: 56, y: 46, w: 40, h: 44, cutout: true }),
        handleFooter(),
      ],
    }),
  },
  {
    id: "doc-dividida",
    label: "Documental: duas fotos",
    category: "interno",
    // Duas fotos empilhadas, cada uma com uma frase: em cima o título, embaixo o texto.
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("grade", { x: 0, y: 0, w: 100, h: 100, grid: "2h", gap: 0, radius: 0, dim: 42 }),
        el("titulo", {
          x: 9,
          y: 33,
          w: 82,
          size: fitFontSize(ph(title, "“Eu nunca consigo terminar nada.”"), 46, 82, 15, 0.52, 1.18),
          family: "sans",
          align: "center",
          color: "branco",
          highlight: "negrito",
          text: ph(title, "“Eu nunca consigo terminar nada.”"),
          shadow: true,
        }),
        el("texto", {
          x: 9,
          y: 81,
          w: 82,
          size: fitFontSize(ph(body, "“Eu sou capaz de concluir o que começo, mesmo em pequenos passos.”"), 46, 82, 12, 0.52, 1.18),
          family: "sans",
          align: "center",
          color: "branco",
          text: ph(body, "“Eu sou capaz de concluir o que começo, mesmo em pequenos passos.”"),
          shadow: true,
        }),
        el("texto", { x: 15, y: 95.5, w: 70, size: 18, align: "center", color: "branco", text: "{usuario}" }),
      ],
    }),
  },
  {
    id: "interno-conversa",
    label: "Print de conversa",
    category: "interno",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("titulo", { x: 8, y: 7, w: 84, size: 56, text: ph(title, "O que os clientes **dizem**") }),
        el("conversa", {
          x: 8,
          y: 22,
          w: 84,
          h: 66,
          size: 36,
          chat: "claro",
          time: "14:32",
          text: chatText(body, ["Passando pra agradecer", "Segui as dicas e fechei 3 clientes essa semana", "Eu: Isso é resultado seu! Parabéns", "Obrigada por compartilhar"]),
        }),
        el("numeracao", { x: 80, y: 92, w: 12, size: 22 }),
      ],
    }),
  },
  {
    id: "interno-dado",
    label: "Dado em destaque",
    category: "interno",
    build: ({ title, body }) => {
      const number = title.match(/[+-]?\d+(?:[.,]\d+)?\s*[%x]?/)?.[0]?.trim() ?? "";
      const rest = title.replace(number, "").trim();
      return {
        bg: "fundo",
        overlay: "nenhuma",
        elements: [
          el("titulo", { x: 8, y: 18, w: 84, size: 300, family: "display", color: "destaque", text: ph(number, "+37%") }),
          el("titulo", { x: 8, y: 52, w: 84, size: 60, text: rest || ph(body, "dos clientes voltam no **mesmo mês**") }),
          el("texto", { x: 8, y: 70, w: 80, size: 30, text: rest ? ph(body, "Explique de onde vem o número e o que ele significa.") : "" }),
          ...footer(),
        ],
      };
    },
  },
  {
    id: "interno-checklist",
    label: "Checklist",
    category: "interno",
    build: ({ title, body }) => {
      const items = lines(body, ["Primeiro ponto importante", "Segundo ponto importante", "Terceiro ponto importante"], 4);
      return {
        bg: "fundo",
        overlay: "nenhuma",
        elements: [
          el("titulo", { x: 8, y: 12, w: 84, size: 68, upper: true, text: ph(title, "Antes de **começar**, confira") }),
          ...items.flatMap((item, i) => [
            el("icone", { x: 8, y: 35 + i * 13.5, w: 10, size: 56, icon: "check", fill: "destaque" }),
            el("texto", { x: 22, y: 36 + i * 13.5, w: 70, size: 34, text: item }),
          ]),
          ...footer(),
        ],
      };
    },
  },
  {
    id: "interno-passo",
    label: "Passo a passo",
    category: "interno",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("titulo", { x: 8, y: 14, w: 50, size: 220, family: "display", color: "destaque", text: "{n}" }),
        el("cartao", { x: 8, y: 44, w: 16, h: 0.8, radius: 4, fill: "destaque" }),
        el("titulo", { x: 8, y: 48, w: 84, size: 68, text: ph(title, "Defina **um** objetivo por post") }),
        el("texto", { x: 8, y: 66, w: 80, size: 32, text: ph(body, "Explique o passo em duas ou três frases.") }),
        el("numeracao", { x: 80, y: 92, w: 12, size: 22 }),
      ],
    }),
  },
  {
    id: "interno-mito-verdade",
    label: "Mito × verdade",
    category: "interno",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("cartao", { x: 6, y: 8, w: 88, h: 36, fill: "preto", radius: 32 }),
        el("etiqueta", { x: 11, y: 13, w: 40, size: 22, text: "MITO", fill: "branco", color: "preto" }),
        el("titulo", { x: 11, y: 20, w: 78, size: 52, color: "branco", text: ph(title, "Postar todo dia é o que faz crescer") }),
        el("cartao", { x: 6, y: 48, w: 88, h: 36, fill: "destaque", radius: 32 }),
        el("etiqueta", { x: 11, y: 53, w: 40, size: 22, text: "VERDADE", fill: "preto", color: "branco" }),
        el("texto", { x: 11, y: 60, w: 78, size: 34, color: "fundo", text: ph(body, "Constância importa, mas o que faz crescer é conteúdo que as pessoas salvam e compartilham.") }),
        ...footer(),
      ],
    }),
  },
  {
    id: "interno-antes-depois",
    label: "Antes × depois",
    category: "interno",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("grade", { x: 0, y: 0, w: 100, h: 54, grid: "2v", gap: 6, radius: 0 }),
        el("etiqueta", { x: 4, y: 4, w: 40, size: 22, text: "ANTES", fill: "preto" }),
        el("etiqueta", { x: 54, y: 4, w: 40, size: 22, text: "DEPOIS", fill: "destaque" }),
        el("titulo", { x: 8, y: 59, w: 84, size: 64, text: ph(title, "O que muda em **30 dias**") }),
        el("texto", { x: 8, y: 75, w: 84, size: 30, text: ph(body, "Conte o que foi feito entre uma foto e a outra.") }),
        ...footer(91),
      ],
    }),
  },
  {
    id: "interno-citacao-foto",
    label: "Citação com foto",
    category: "interno",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("imagem", { x: 0, y: 0, w: 46, h: 100, radius: 0 }),
        el("titulo", { x: 52, y: 14, w: 20, size: 220, family: "serif", color: "destaque", text: "“" }),
        el("titulo", { x: 52, y: 32, w: 42, size: 54, family: "serif", italic: true, text: ph(title, "Eu sou o primeiro **filtro**.") }),
        el("texto", { x: 52, y: 72, w: 42, size: 26, text: ph(body, "— {nome}") }),
        el("numeracao", { x: 80, y: 92, w: 12, size: 22 }),
      ],
    }),
  },
  {
    id: "foto-com-texto",
    label: "Foto em cima, texto embaixo",
    category: "interno",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("imagem", { x: 0, y: 0, w: 100, h: 52, radius: 0 }),
        el("titulo", { x: 8, y: 57, w: 84, size: 64, text: ph(title, "Título do slide") }),
        el("texto", { x: 8, y: 74, w: 84, size: 32, text: ph(body, "Texto de apoio.") }),
        el("perfil", { x: 8, y: 91, w: 55, size: 22 }),
      ],
    }),
  },

  // ---------- Fechamento ----------
  {
    id: "final-salvar",
    label: "Salve este post",
    category: "final",
    build: ({ title, body }) => ({
      bg: "destaque",
      overlay: "nenhuma",
      elements: [
        el("icone", { x: 40, y: 18, w: 20, size: 120, icon: "estrela", align: "center", fill: "fundo" }),
        el("titulo", { x: 8, y: 40, w: 84, size: 92, align: "center", upper: true, text: ph(title, "Gostou? **Salve** para não perder") }),
        el("texto", { x: 12, y: 64, w: 76, size: 32, align: "center", text: ph(body, "E mande para alguém que precisa ver isso hoje.") }),
        el("perfil", { x: 15, y: 86, w: 70, size: 26, variant: "chip", align: "center", fill: "fundo" }),
      ],
    }),
  },
  {
    id: "final-seguir",
    label: "Siga o perfil",
    category: "final",
    photo: true,
    build: ({ title, body, hasImage }) => ({
      ...photoBg(hasImage, "total"),
      elements: [
        el("perfil", { x: 10, y: 30, w: 80, size: 40, variant: "tweet", verified: true, align: "center" }),
        el("titulo", { x: 8, y: 46, w: 84, size: 80, align: "center", text: ph(title, "Quer mais conteúdos **assim**?") }),
        el("texto", { x: 12, y: 64, w: 76, size: 32, align: "center", text: ph(body, "Siga {usuario} e ative as notificações.") }),
        el("etiqueta", { x: 25, y: 80, w: 50, size: 30, align: "center", text: "SEGUIR", fill: "destaque" }),
      ],
    }),
  },
  {
    id: "colagem-final",
    label: "Colagem: fechamento",
    category: "final",
    build: ({ title, body }) => ({
      bg: "papel-destaque",
      overlay: "nenhuma",
      elements: [
        el("titulo", {
          x: 9,
          y: 24,
          w: 78,
          size: fitFontSize(ph(title, "Seu marketing não precisa parecer com o de todo mundo para vender."), 74, 78, 30, 0.5, 1.1),
          family: "maquina",
          text: ph(title, "Seu marketing não precisa parecer com o de todo mundo para vender."),
        }),
        el("texto", { x: 9, y: 56, w: 74, size: 36, family: "maquina", text: ph(body, "Se você quer uma comunicação mais clara e coerente, comente CONSULTORIA.") }),
        handleFooter(),
      ],
    }),
  },
  {
    id: "doc-final",
    label: "Documental: fechamento da marca",
    category: "final",
    build: ({ title, body }) => ({
      bg: "grao",
      overlay: "nenhuma",
      elements: [
        el("titulo", {
          x: 9,
          y: 26,
          w: 82,
          size: fitFontSize(ph(title, "Na **Mentoria Na Bala**, você tem acompanhamento e um ambiente com pessoas que também decidiram crescer."), 78, 82, 34, 0.42, 1.08),
          family: "display",
          highlight: "cor",
          text: ph(title, "Na **Mentoria Na Bala**, você tem acompanhamento e um ambiente com pessoas que também decidiram crescer."),
        }),
        el("texto", { x: 9, y: 66, w: 82, size: 36, align: "center", text: ph(body, "Quer viver na bala?") }),
        el("etiqueta", { x: 9, y: 73, w: 82, size: 30, align: "center", fill: "destaque", text: ph("", "Clique no link da bio.") }),
        el("texto", { x: 15, y: 94, w: 70, size: 20, align: "center", text: "{usuario}" }),
      ],
    }),
  },
  {
    id: "final-comente",
    label: "Comente uma palavra",
    category: "final",
    build: ({ title, body }) => ({
      bg: "fundo",
      overlay: "nenhuma",
      elements: [
        el("icone", { x: 8, y: 16, w: 16, size: 90, icon: "conversa", fill: "destaque" }),
        el("titulo", { x: 8, y: 34, w: 84, size: 90, upper: true, text: ph(title, "Comente **QUERO** que eu te mando o passo a passo") }),
        el("texto", { x: 8, y: 66, w: 80, size: 30, text: ph(body, "Respondo um por um, no direct.") }),
        ...footer(),
      ],
    }),
  },
];

export const presetById = (id: string) => FREE_PRESETS.find((p) => p.id === id) ?? FREE_PRESETS[0];

const TEXT_KINDS: FreeElementKind[] = ["titulo", "texto", "etiqueta", "conversa"];

/**
 * Monta um modelo. Com `placeholders: false` (conteúdo vindo do assistente ou de outro slide),
 * os elementos de texto sem conteúdo saem, em vez de mostrar texto de exemplo.
 */
export function buildPreset(id: string, input: FreePresetInput, { placeholders = true } = {}): FreeSlide {
  usePlaceholders = placeholders;
  try {
    const slide = { ...presetById(id).build(input), preset: id };
    if (placeholders) return slide;
    return { ...slide, elements: slide.elements.filter((e) => !TEXT_KINDS.includes(e.kind) || (e.text ?? "").trim()) };
  } finally {
    usePlaceholders = true;
  }
}


/** Modelos que dependem do conteúdo (lista, número, passo...): variar o design não troca esses. */
export const SEMANTIC_PRESETS = new Set([
  "capa-numero",
  "capa-pergunta",
  "capa-tiras",
  "capa-3-tiras",
  "interno-dado",
  "interno-checklist",
  "interno-passo",
  "interno-mito-verdade",
  "interno-antes-depois",
  "interno-citacao-foto",
  // Prints de conversa: só fazem sentido com mensagens reais, nunca por sorteio.
  "capa-conversa",
  "capa-notificacoes",
  "interno-conversa",
]);

/** Modelos em que o "texto" da tela são as mensagens do print (inclusive na capa). */
export const CHAT_PRESETS: ReadonlySet<string> = new Set(["capa-conversa", "capa-notificacoes", "interno-conversa"]);

/** O modelo pede uma foto (fundo ou espaço de imagem)? */
export function presetWantsImage(id: string): boolean {
  const preset = presetById(id);
  if (preset.photo) return true;
  return preset.build({ title: "", body: "", hasImage: false }).elements.some((e) => e.kind === "imagem" || e.kind === "grade");
}

/**
 * Troca o modelo de um slide Livre levando o texto (título e texto principais) e as fotos que ele já tem.
 * `fallback` é o título e o texto do slide, usados quando o Livre ainda está vazio.
 */
export function rebuildWithPreset(free: FreeSlide, id: string, fallback: { title: string; body: string; image: string | null }): FreeSlide {
  const isPlainTitle = (t: string) => t.trim() && !/^\{n\}$|^[\d+%\-x.,\s]{1,6}$|^[“"?]$/.test(t.trim());
  const titleEl = free.elements.find((e) => e.kind === "titulo" && isPlainTitle(e.text ?? ""));
  const bodyEl =
    free.elements.find((e) => e.kind === "texto" && (e.text ?? "").trim() && !/^\{/.test(e.text ?? "")) ??
    free.elements.find((e) => e.kind === "conversa" && (e.text ?? "").trim());
  // Sem título separado (ex.: modelo tweet junta tudo num texto), vale o título e o texto do slide.
  const title = titleEl ? (titleEl.text ?? "") : fallback.title;
  const body = titleEl ? (bodyEl?.text ?? fallback.body) : fallback.body;
  const next = buildPreset(id, { title, body, hasImage: Boolean(fallback.image) }, { placeholders: !title.trim() && !body.trim() });
  const photos = [
    ...free.elements.filter((e) => e.kind === "imagem" && e.image).map((e) => e.image as string),
    ...free.elements.flatMap((e) => (e.kind === "grade" ? (e.images ?? []).filter((x): x is string => Boolean(x)) : [])),
  ];
  let k = 0;
  const elements = next.elements.map((e) => {
    if (e.kind === "imagem" && photos[k]) return { ...e, image: photos[k++] };
    if (e.kind === "grade") return { ...e, images: photos.slice(k, k + 4) };
    return e;
  });
  return { ...next, elements, pan: free.pan ?? null };
}

// ---------- Telas salvas como estilo (modelos próprios do cliente) ----------

/** Título "de verdade" (não um número de lista, "?" ou aspas soltas). */
const isMainText = (t: string | undefined) => Boolean(t?.trim()) && !/^\{n\}$|^[\d+%\-x.,\s]{1,6}$|^[“"?]$/.test((t ?? "").trim());

/** O título principal da tela: o maior título com texto. */
function mainTitle(free: FreeSlide): FreeElement | undefined {
  return free.elements
    .filter((e) => e.kind === "titulo" && isMainText(e.text))
    .sort((a, b) => (b.size ?? 96) * b.w - (a.size ?? 96) * a.w)[0];
}

const isToken = (t: string | undefined) => /^\{\w+\}$/.test((t ?? "").trim());

/** O texto de apoio principal: o texto mais longo que não é marca ({usuario}, {n}...). */
function mainBody(free: FreeSlide): FreeElement | undefined {
  return free.elements
    .filter((e) => e.kind === "texto" && (e.text ?? "").trim() && !isToken(e.text))
    .sort((a, b) => (b.text ?? "").length - (a.text ?? "").length)[0];
}

/**
 * Blocos de texto de conteúdo de um modelo salvo, de cima para baixo: textos com letra de leitura
 * (26 px ou mais). Textos pequenos (rodapé, data, "Powered by") e marcas ({usuario}) ficam fixos.
 */
function bodyBlocks(free: FreeSlide): FreeElement[] {
  const blocks = free.elements
    .filter((e) => e.kind === "texto" && (e.text ?? "").trim() && !isToken(e.text) && (e.size ?? 38) >= 26)
    .sort((a, b) => a.y - b.y);
  if (blocks.length) return blocks;
  const main = mainBody(free);
  return main ? [main] : [];
}

const isListText = (t: string | undefined) => (t ?? "").split("\n").filter((l) => /^\s*([→•\-–✓✔]|\d+[.)])/.test(l)).length >= 2;

const plainLength = (t: string | undefined) => (t ?? "").replace(/\*\*/g, "").trim().length;

/** Tira as fotos e o que é do carrossel (pedaço de foto espalhada) para guardar a tela como modelo. */
export function stripTemplate(free: FreeSlide): FreeSlide {
  return {
    bg: free.bg,
    overlay: free.overlay,
    progress: free.progress,
    preset: null,
    pan: null,
    elements: free.elements.map((e) => {
      const out: FreeElement = { ...e };
      if (e.kind === "imagem") out.image = null;
      if (e.kind === "grade") out.images = [];
      return out;
    }),
  };
}

/** O que a IA precisa saber de um modelo salvo para escrever o texto do tamanho certo. */
export interface TemplateInfo {
  titleChars: number;
  bodyChars: number;
  /** Blocos de texto (de cima para baixo): tamanho e se é lista. */
  blocks: { chars: number; list: boolean }[];
  hasTag: boolean;
  photos: number;
}

export function templateInfo(tpl: FreeSlide): TemplateInfo {
  const photos =
    (tpl.bg === "foto" ? 1 : 0) +
    tpl.elements.reduce((n, e) => n + (e.kind === "imagem" ? 1 : e.kind === "grade" ? gridSlots(e.grid) : 0), 0);
  return {
    titleChars: plainLength(mainTitle(tpl)?.text),
    bodyChars: bodyBlocks(tpl).reduce((n, e) => n + plainLength(e.text), 0),
    blocks: bodyBlocks(tpl).map((e) => ({ chars: plainLength(e.text), list: isListText(e.text) })),
    hasTag: tpl.elements.some((e) => e.kind === "etiqueta" && (e.text ?? "").trim()),
    photos,
  };
}

/** O modelo pede foto (fundo, imagem ou grade)? */
export const templateWantsImage = (tpl: FreeSlide) => templateInfo(tpl).photos > 0;

/**
 * Monta uma tela a partir de um modelo salvo: o título e o texto principais recebem o conteúdo novo
 * (com a fonte encolhendo se o texto for maior que o do modelo); textos fixos (@, rodapé, data) ficam.
 * A etiqueta só muda quando vem uma; sem foto, o fundo de foto vira cor de fundo.
 */
export function fillTemplate(tpl: FreeSlide, input: { title: string; body: string; tag?: string; hasImage: boolean }): FreeSlide {
  const titleEl = mainTitle(tpl);
  const blocks = bodyBlocks(tpl);
  const shrink = (el: FreeElement, text: string): number | undefined => {
    const before = plainLength(el.text);
    const after = plainLength(text);
    if (!el.size || !before || after <= before * 1.1) return el.size;
    return Math.max(Math.round(el.size * 0.6), Math.round(el.size * Math.sqrt(before / after)));
  };
  // Modelo sem título separado (ex.: tweet): título e texto vão juntos no texto principal.
  const bodyText = titleEl ? input.body : [input.title, input.body].filter((t) => t.trim()).join("\n\n");
  // Vários blocos: o texto vem separado por linha em branco, um pedaço por bloco (o último leva o resto).
  const parts = blocks.length > 1 ? bodyText.split(/\n\s*\n/).map((p) => p.trim()) : [bodyText.trim()];
  const textOf = (k: number) => (k < blocks.length - 1 ? (parts[k] ?? "") : parts.slice(k).filter(Boolean).join("\n\n"));
  const elements = tpl.elements
    .map((e): FreeElement | null => {
      const fresh = { ...e, id: newElementId() };
      if (titleEl && e.id === titleEl.id) return { ...fresh, text: input.title, size: shrink(e, input.title) };
      const k = blocks.findIndex((b) => b.id === e.id);
      if (k >= 0) {
        const text = textOf(k);
        return text ? { ...fresh, text, size: shrink(e, text) } : null;
      }
      if (e.kind === "etiqueta" && input.tag?.trim()) return { ...fresh, text: e.upper === false ? input.tag.trim() : input.tag.trim().toUpperCase() };
      return fresh;
    })
    .filter((e): e is FreeElement => e !== null);
  return { ...tpl, bg: tpl.bg === "foto" && !input.hasImage ? "fundo" : tpl.bg, elements, preset: null, pan: null };
}

/** Assinatura do desenho de uma tela (tipos e posições), para não salvar duas telas internas iguais. */
export function layoutSignature(free: FreeSlide): string {
  const r = (n: number | undefined) => Math.round((n ?? 0) / 4);
  return [free.bg, free.overlay, ...free.elements.map((e) => `${e.kind}:${r(e.x)},${r(e.y)},${r(e.w)},${r(e.h)},${e.grid ?? ""}`)].join("|");
}

/** Título, texto e etiqueta principais de uma tela Livre (o que a equipe escreveu nela). */
export function freeTexts(free: FreeSlide): { title: string; body: string; tag: string } {
  return {
    title: mainTitle(free)?.text ?? "",
    body: bodyBlocks(free)
      .map((e) => e.text ?? "")
      .join("\n\n"),
    tag: free.elements.find((e) => e.kind === "etiqueta")?.text ?? "",
  };
}

/** Fotos de uma tela Livre, na ordem dos espaços (imagens e grades) e o fundo por último. */
export function freePhotos(free: FreeSlide | null | undefined, bgImage: string | null | undefined): string[] {
  const slots = (free?.elements ?? []).flatMap((e) =>
    e.kind === "imagem" ? (e.image ? [e.image] : []) : e.kind === "grade" ? (e.images ?? []).filter((x): x is string => Boolean(x)) : [],
  );
  return bgImage ? [...slots, bgImage] : slots;
}
