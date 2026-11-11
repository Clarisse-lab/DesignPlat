// Revisão automática de uma peça antes de sair: o que dá para conferir sem renderizar (fotos que
// faltam, @ errado, destaque sem fechar, legenda) e, no navegador, o que depende da tela montada
// (texto fora da tela, letra pequena, pouco contraste, textos se sobrepondo).

import { contrastRatio } from "../templates/utils";
import { gridSlots, type FreeSlide } from "../templates/free";

export type IssueLevel = "erro" | "aviso";

export interface ReviewIssue {
  /** Índice da tela (0…); null para a legenda / peça toda. */
  tela: number | null;
  nivel: IssueLevel;
  msg: string;
  /** Elemento da tela (para selecionar no editor). */
  elementId?: string;
  /** Sugestão de correção (revisão de português). */
  sugestao?: string;
}

interface SlideLike {
  layout: string;
  title: string;
  body: string;
  image?: string | null;
  free?: FreeSlide | null;
}

const IG_CAPTION_MAX = 2200;
const IG_HASHTAG_MAX = 30;
const CTA = /\b(coment[ae]|comentário|salv[ae]|compartilh\w*|envi[ae]|mand[ae]|marqu[ei]|clique|cliqu[ei]|link|bio|dm|direct|chama|me chama|me conta|responde|segu[ea]|siga|inscrev\w*|garant[ae]|acess[ae]|agend[ae]|reserv[ae]|vem|bora)\b/i;

const textsOf = (sl: SlideLike): { id?: string; text: string }[] =>
  sl.layout === "livre" && sl.free
    ? sl.free.elements.filter((e) => (e.text ?? "").trim()).map((e) => ({ id: e.id, text: e.text ?? "" }))
    : [{ text: sl.title }, { text: sl.body }].filter((t) => t.text.trim());

/** Checagens que não precisam da tela montada. */
export function staticChecks(input: { slides: SlideLike[]; handle: string; legenda?: string | null }): ReviewIssue[] {
  const out: ReviewIssue[] = [];
  const handle = input.handle.replace(/^@+/, "").toLowerCase();

  input.slides.forEach((sl, tela) => {
    if (sl.layout === "livre" && sl.free) {
      if (sl.free.bg === "foto" && !sl.image) out.push({ tela, nivel: "erro", msg: "Fundo de foto sem foto (a tela sai preta)." });
      for (const e of sl.free.elements) {
        if (e.kind === "imagem" && !e.image) out.push({ tela, nivel: "erro", msg: "Espaço de foto vazio.", elementId: e.id });
        if (e.kind === "grade") {
          const missing = gridSlots(e.grid) - (e.images ?? []).filter(Boolean).length;
          if (missing > 0) out.push({ tela, nivel: "erro", msg: `Grade de fotos com ${missing} espaço(s) vazio(s).`, elementId: e.id });
        }
      }
    }
    for (const t of textsOf(sl)) {
      if (((t.text.match(/\*\*/g) ?? []).length) % 2) out.push({ tela, nivel: "aviso", msg: "Destaque (**) aberto e não fechado: aparece um ** no texto.", elementId: t.id });
      if (/lorem ipsum|escreva aqui|seu texto aqui|título aqui|texto de exemplo/i.test(t.text)) {
        out.push({ tela, nivel: "erro", msg: "Texto de exemplo esquecido na tela.", elementId: t.id });
      }
      for (const m of t.text.matchAll(/(^|[\s(])@([a-z0-9._]{3,30})/gi)) {
        if (handle && m[2].toLowerCase() !== handle) out.push({ tela, nivel: "aviso", msg: `@${m[2]} escrito na tela, mas o cliente é @${handle}.`, elementId: t.id });
      }
    }
  });

  const legenda = (input.legenda ?? "").trim();
  if (legenda) {
    if (legenda.length > IG_CAPTION_MAX) out.push({ tela: null, nivel: "erro", msg: `Legenda com ${legenda.length} caracteres (o Instagram aceita até ${IG_CAPTION_MAX}).` });
    const tags = legenda.match(/#[\p{L}\p{N}_]+/gu) ?? [];
    if (tags.length > IG_HASHTAG_MAX) out.push({ tela: null, nivel: "erro", msg: `Legenda com ${tags.length} hashtags (o Instagram aceita até ${IG_HASHTAG_MAX}).` });
    const fim = legenda.replace(/#[\p{L}\p{N}_]+/gu, "").trim().slice(-280);
    if (!CTA.test(fim)) out.push({ tela: null, nivel: "aviso", msg: "Legenda sem chamada para ação no fim (comente, salve, link da bio…)." });
  }
  return out;
}

// ---------- Na tela montada (navegador) ----------

const MIN_FONT = 24; // px num canvas de 1080 de largura
const TEXT_KINDS = new Set(["titulo", "texto", "etiqueta", "arraste", "perfil"]);
const COVER_KINDS = new Set(["cartao", "imagem", "grade", "mancha", "conversa"]);

function parseRgb(value: string): [number, number, number, number] | null {
  const m = value.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = "1"] = m[1].split(/[,\s/]+/).filter(Boolean);
  return [Number(r), Number(g), Number(b), Number(a)];
}
const hex = ([r, g, b]: number[]) => `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;

/**
 * Confere uma tela já carregada num iframe: texto passando da borda, letra pequena, pouco contraste
 * sobre fundo liso e textos encavalados. `photoBg`: fundo é foto (o contraste não dá para medir).
 */
export function domChecks(doc: Document, tela: number, opts: { width: number; height: number; photoBg: boolean }): ReviewIssue[] {
  const out: ReviewIssue[] = [];
  const { width: W, height: H } = opts;
  const scale = 1080 / W;
  const nodes = Array.from(doc.querySelectorAll<HTMLElement>("[data-eid]"));
  const rects = nodes.map((n) => ({ n, id: n.dataset.eid ?? "", kind: n.dataset.kind ?? "", r: n.getBoundingClientRect() }));
  const covers = rects.filter((x) => COVER_KINDS.has(x.kind));
  // Glifo decorativo (um "?" ou aspas gigantes vazando de propósito) não conta como texto.
  const texts = rects.filter((x) => TEXT_KINDS.has(x.kind) && (x.n.textContent ?? "").trim().length > 3);
  const view = doc.defaultView;
  const pageBg = parseRgb(view?.getComputedStyle(doc.body).backgroundColor ?? "") ?? [255, 255, 255, 1];

  for (const { n, id, kind, r } of texts) {
    const label = kind === "titulo" ? "Título" : kind === "etiqueta" ? "Etiqueta" : "Texto";
    if (r.bottom > H + 2 || r.right > W + 2 || r.left < -2 || r.top < -2) {
      out.push({ tela, nivel: "erro", msg: `${label} passando da borda da tela (vai sair cortado).`, elementId: id });
    } else if (n.scrollWidth > n.clientWidth + 4) {
      out.push({ tela, nivel: "aviso", msg: `${label} com palavra maior que a caixa (estoura para o lado).`, elementId: id });
    }
    const style = view?.getComputedStyle(kind === "etiqueta" ? (n.querySelector<HTMLElement>(".tag") ?? n) : n);
    const size = parseFloat(style?.fontSize ?? "0") * scale;
    // Só frase de leitura: rótulos curtos (@, linha de apoio, rodapé) são pequenos de propósito.
    if ((kind === "titulo" || kind === "texto") && size > 0 && size < MIN_FONT && (n.textContent ?? "").trim().length > 40) {
      out.push({ tela, nivel: "aviso", msg: `${label} com letra de ${Math.round(size)} px: pequena para ler no celular (mín. ${MIN_FONT}).`, elementId: id });
    }
    // Contraste: só onde o fundo é liso e conhecido (fundo da tela ou a própria pílula da etiqueta).
    const fg = parseRgb(style?.color ?? "");
    const ownBg = kind === "etiqueta" ? parseRgb(style?.backgroundColor ?? "") : null;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const onCover = covers.some((c) => cx >= c.r.left && cx <= c.r.right && cy >= c.r.top && cy <= c.r.bottom);
    const bg = ownBg && ownBg[3] > 0.9 ? ownBg : !opts.photoBg && !onCover ? pageBg : null;
    if (fg && bg) {
      const ratio = contrastRatio(hex(fg), hex(bg));
      // Limites abaixo dos do WCAG (3 e 4,5): o objetivo é pegar texto que some, não discutir paleta.
      const need = size >= 40 ? 2.2 : 3;
      if (ratio < need) out.push({ tela, nivel: "aviso", msg: `${label} com pouco contraste com o fundo (${ratio.toFixed(1)}:1; o ideal é ${need}:1 ou mais).`, elementId: id });
    }
  }

  // Textos encavalados: interseção grande entre dois textos.
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = texts[i].r;
      const b = texts[j].r;
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w <= 0 || h <= 0) continue;
      const small = Math.min(a.width * a.height, b.width * b.height);
      if (small > 0 && (w * h) / small > 0.2) {
        out.push({ tela, nivel: "aviso", msg: "Dois textos se sobrepondo.", elementId: texts[j].id });
      }
    }
  }

  // Layouts clássicos (sem elementos marcados): conteúdo maior que a tela.
  if (!nodes.length && doc.documentElement.scrollHeight > H + 4) {
    out.push({ tela, nivel: "erro", msg: "Conteúdo maior que a tela (o texto vai sair cortado). Encurte o texto." });
  }
  return out;
}
