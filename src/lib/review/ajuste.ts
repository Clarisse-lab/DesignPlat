// Ajuste automático das telas Livre: monta cada tela num iframe escondido (como a revisão), mede os
// elementos e corrige o que a medida mostra, direto nos dados da tela:
// - texto saindo pela lateral → volta para dentro da margem;
// - texto de corpo pequeno demais para o celular → sobe para o mínimo legível;
// - elementos se sobrepondo → empurra os de baixo; sem espaço, encolhe o maior texto aos poucos;
// - texto passando do fim da tela, do cartão ou batendo no rodapé (@, Arraste →, numeração).
// O resultado volta para os elementos (x, y, w, size): a prévia e o PNG continuam sendo o mesmo HTML.

import { CANVAS_SIZES } from "../formats";
import type { FeedBrand, FeedSlide, FeedStyle } from "../templates/feed";
import { renderFeedSlide, sectionNumberAt } from "../templates/feed";
import { browserFontCss } from "../templates/fonts";
import type { FreeElement } from "../templates/free";

/** Elementos que participam do fluxo vertical (o resto é fundo: foto, grade, cartão grande, mancha). */
const FLOW = new Set(["titulo", "texto", "etiqueta", "perfil", "icone", "numeracao", "arraste", "conversa", "cartao"]);
/** Quanto cada tipo pode encolher (fração do tamanho original) e o mínimo em px. */
const SHRINK: Record<string, { frac: number; min: number }> = {
  titulo: { frac: 0.45, min: 40 },
  texto: { frac: 0.75, min: 30 },
  etiqueta: { frac: 0.8, min: 18 },
  conversa: { frac: 0.7, min: 20 },
};
/** Corpo de texto abaixo disso fica ilegível no celular (a tela tem 1080 px e aparece com ~360). */
export const MIN_BODY_PX = 34;
const GAP = 18; // px entre elementos empilhados
const MARGIN = 0.045; // 4,5% de margem nas bordas

interface Item {
  el: FreeElement;
  node: HTMLElement;
  pinned: boolean; // rodapé (@, Arraste →, numeração perto do fim): fica onde está
  container: Box | null; // cartão grande que contém o elemento
  scale: number;
  topPx: number;
}
interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const isDivider = (e: FreeElement) => e.kind === "cartao" && (e.h ?? 20) < 3;
const isFlow = (e: FreeElement) => FLOW.has(e.kind) && (e.kind !== "cartao" || isDivider(e));
const isPinned = (e: FreeElement) => (e.kind === "perfil" || e.kind === "arraste" || e.kind === "numeracao") && e.y >= 82;

async function loadInto(frame: HTMLIFrameElement, html: string): Promise<Document | null> {
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    frame.addEventListener("load", done, { once: true });
    frame.srcdoc = html;
    setTimeout(done, 4000);
  });
  const doc = frame.contentDocument;
  if (!doc) return null;
  await Promise.race([doc.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]);
  return doc;
}

/** Multiplica o tamanho da letra do nó e de tudo dentro dele que tem tamanho próprio. */
function scaleFonts(node: HTMLElement, factor: number) {
  const all = [node, ...Array.from(node.querySelectorAll<HTMLElement>("[style*='font-size']"))];
  for (const n of all) {
    const fs = parseFloat(n.style.fontSize);
    if (fs) n.style.fontSize = `${fs * factor}px`;
  }
}

/** Ajusta uma tela já carregada no documento. Devolve os elementos novos (ou null se nada mudou). */
export function fitDocument(doc: Document, elements: FreeElement[], width: number, height: number): FreeElement[] | null {
  const mx = width * MARGIN;
  const my = height * MARGIN;
  // Caixa real do conteúdo: o texto pode transbordar da caixa do elemento (palavra longa, caixa alta).
  const rectOf = (n: HTMLElement): Box => {
    const r = n.getBoundingClientRect();
    const range = doc.createRange();
    range.selectNodeContents(n);
    const c = range.getBoundingClientRect();
    if (!c.width && !c.height) return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    return { top: Math.min(r.top, c.top), bottom: Math.max(r.bottom, c.bottom), left: Math.min(r.left, c.left), right: Math.max(r.right, c.right) };
  };
  const containers = elements
    .filter((e) => e.kind === "cartao" && !isDivider(e))
    .map((e) => doc.querySelector<HTMLElement>(`[data-eid="${CSS.escape(e.id)}"]`))
    .filter((n): n is HTMLElement => Boolean(n))
    .map(rectOf);

  const items: Item[] = [];
  const out = new Map<string, FreeElement>();
  for (const el of elements) {
    if (!isFlow(el)) continue;
    const node = doc.querySelector<HTMLElement>(`[data-eid="${CSS.escape(el.id)}"]`);
    if (!node) continue;
    const r = rectOf(node);
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const container = containers.find((c) => cx > c.left && cx < c.right && cy > c.top && cy < c.bottom) ?? null;
    // topPx = topo da caixa do elemento (o "top" do estilo), não do texto: mexer só por diferença evita desvio.
    const styleTop = parseFloat(node.style.top);
    items.push({ el, node, pinned: isPinned(el), container, scale: 1, topPx: Number.isFinite(styleTop) ? (styleTop / 100) * height : node.getBoundingClientRect().top });
  }
  if (!items.length) return null;
  let changed = false;
  const setTop = (it: Item, px: number) => {
    it.topPx = px;
    it.node.style.top = `${(px / height) * 100}%`;
    changed = true;
  };
  const shrink = (it: Item, factor: number): boolean => {
    const rule = SHRINK[it.el.kind];
    if (!rule) return false;
    const size = (it.el.size ?? 40) * it.scale;
    const floor = Math.max(rule.min, (it.el.size ?? 40) * rule.frac);
    if (size <= floor + 0.5) return false;
    const next = Math.max(floor, size * factor) / ((it.el.size ?? 40) * it.scale);
    scaleFonts(it.node, next);
    it.scale *= next;
    changed = true;
    return true;
  };

  // 1. Lateral: nada passa da margem.
  for (const it of items) {
    const x = it.el.x, w = it.el.w;
    const lim = it.container ? { l: it.container.left / width * 100 + 3, r: it.container.right / width * 100 - 3 } : { l: MARGIN * 100, r: 100 - MARGIN * 100 };
    if (x + w > lim.r + 0.5 || x < lim.l - 0.5) {
      const nw = Math.min(w, lim.r - lim.l);
      const nx = Math.min(Math.max(x, lim.l), lim.r - nw);
      out.set(it.el.id, { ...(out.get(it.el.id) ?? it.el), x: Math.round(nx * 10) / 10, w: Math.round(nw * 10) / 10 });
      it.node.style.left = `${nx}%`;
      it.node.style.width = `${nw}%`;
      changed = true;
    }
  }
  // 2. Corpo legível.
  for (const it of items) {
    if (it.el.kind === "texto" && (it.el.size ?? 40) < MIN_BODY_PX && !it.pinned) {
      const f = MIN_BODY_PX / (it.el.size ?? 40);
      scaleFonts(it.node, f);
      it.scale *= f;
      changed = true;
    }
  }

  // 3. Fluxo vertical.
  const overlapX = (a: Box, b: Box) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 24;
  const limitBottom = (it: Item) => (it.container ? it.container.bottom - 28 : height - my);
  const limitTop = (it: Item) => (it.container ? it.container.top + 28 : my);
  for (let pass = 0; pass < 60; pass++) {
    const rects = new Map(items.map((it) => [it, rectOf(it.node)]));
    let problem: { a: Item; b: Item | null; need: number } | null = null;
    const sorted = [...items].sort((p, q) => rects.get(p)!.top - rects.get(q)!.top);
    outer: for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i], ra = rects.get(a)!;
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j], rb = rects.get(b)!;
        // Rodapé com rodapé (o @ e o "Arraste →" lado a lado) não é empilhamento.
        if (a.container !== b.container || (a.pinned && b.pinned) || !overlapX(ra, rb)) continue;
        const need = ra.bottom + GAP - rb.top;
        if (need > 1 && rb.top >= ra.top) { problem = { a, b, need }; break outer; }
      }
      if (!a.pinned && ra.bottom > limitBottom(a) + 1) { problem = { a, b: null, need: ra.bottom - limitBottom(a) }; break; }
    }
    // Texto mais largo que a tela (ou o cartão): encolhe até caber na largura.
    if (!problem) {
      const wide = items.find((it) => {
        if (!SHRINK[it.el.kind]) return false;
        const r = rects.get(it)!;
        const l = it.container ? it.container.left + 20 : mx, rr = it.container ? it.container.right - 20 : width - mx;
        return r.left < l - 2 || r.right > rr + 2;
      });
      if (wide && shrink(wide, 0.95)) continue;
    }
    if (!problem) break;
    const { a, b, need } = problem;
    // a) empurra para baixo o elemento de baixo e tudo o que vem depois dele (se couber)
    if (b && !b.pinned) {
      const rb = rects.get(b)!;
      const chain = items.filter((it) => !it.pinned && it.container === b.container && rects.get(it)!.top >= rb.top - 1);
      const fits = chain.every((it) => rects.get(it)!.bottom + need <= limitBottom(it))
        && !items.some((p) => p.pinned && p.container === b.container && chain.some((c) => overlapX(rects.get(c)!, rects.get(p)!) && rects.get(c)!.bottom + need + GAP > rects.get(p)!.top && rects.get(c)!.top < rects.get(p)!.top));
      if (fits) {
        for (const it of chain) setTop(it, it.topPx + need);
        continue;
      }
    }
    // b) sobe o bloco de cima, se houver espaço livre acima dele
    const group = items.filter((it) => !it.pinned && it.container === a.container && rects.get(it)!.top <= rects.get(a)!.top + 1);
    const minTop = Math.min(...group.map((it) => rects.get(it)!.top));
    const above = items.filter((it) => it.container === a.container && !group.includes(it) && rects.get(it)!.bottom <= minTop + 1);
    const ceiling = Math.max(limitTop(a), ...above.filter((it) => group.some((g) => overlapX(rects.get(g)!, rects.get(it)!))).map((it) => rects.get(it)!.bottom + GAP));
    const room = minTop - ceiling;
    if (room > 4) {
      const up = Math.min(room, need);
      for (const it of group) setTop(it, it.topPx - up);
      if (up >= need - 1) continue;
    }
    // c) encolhe o maior texto envolvido, aos poucos
    const candidates = [a, ...(b ? [b] : [])].filter((it) => SHRINK[it.el.kind]);
    candidates.sort((p, q) => (q.el.size ?? 0) * q.scale - (p.el.size ?? 0) * p.scale);
    if (!candidates.some((it) => shrink(it, 0.93))) break; // nada mais a fazer sem desmontar o desenho
  }

  if (!changed) return null;
  let differs = false;
  const result = elements.map((el) => {
    const it = items.find((x) => x.el.id === el.id);
    const base = out.get(el.id) ?? el;
    if (!it) return base;
    const y = Math.round((it.topPx / height) * 1000) / 10;
    const next: FreeElement = { ...base };
    if (Math.abs(y - el.y) > 0.15) next.y = y;
    if (it.scale !== 1 && el.size != null) next.size = Math.max(10, Math.round(el.size * it.scale));
    if (next.y !== el.y || next.size !== el.size || next.x !== el.x || next.w !== el.w) differs = true;
    return next;
  });
  return differs ? result : null;
}

/**
 * Ajusta todas as telas Livre do carrossel. Devolve um mapa id da tela → elementos novos,
 * só para as telas que mudaram.
 */
export async function fitSlides(input: { slides: (FeedSlide & { id: string })[]; brand: FeedBrand; style: FeedStyle }): Promise<Map<string, FreeElement[]>> {
  const result = new Map<string, FreeElement[]>();
  const { width, height } = CANVAS_SIZES[input.style.size];
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:${height}px;border:0;visibility:hidden;pointer-events:none`;
  document.body.appendChild(frame);
  try {
    for (let i = 0; i < input.slides.length; i++) {
      const slide = input.slides[i];
      if (slide.layout !== "livre" || !slide.free || slide.free.pan) continue;
      const html = renderFeedSlide({
        slide,
        brand: input.brand,
        style: input.style,
        index: i,
        total: input.slides.length,
        fontCss: browserFontCss,
        sectionNumber: sectionNumberAt(input.slides, i),
      });
      const doc = await loadInto(frame, html);
      if (!doc) continue;
      const fixed = fitDocument(doc, slide.free.elements, width, height);
      if (fixed) result.set(slide.id, fixed);
    }
  } finally {
    frame.remove();
  }
  return result;
}
