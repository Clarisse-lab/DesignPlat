// Layout "Editorial" (referência: carrosséis jornalísticos como os da @brandsdecoded__).
// As telas são montadas em FLUXO (coluna flexível), não em posição fixa: título, apoio, imagem e
// lista se empilham e a imagem absorve o espaço que sobra. Texto em cima de texto não acontece por
// construção, e o carrossel sai praticamente pronto.
//
// O sistema (tokens) vem do kit do cliente: cor de destaque, fundo claro e escuro, @, nome.
// Tudo é ajustável num lugar só (style.editorial); o resto se calcula sozinho, incluindo o contraste
// da cor de destaque em fundo claro e escuro.
//
// Fundos: claro, escuro, creme (pausa) e foto. No "automático" eles se alternam pela posição da tela,
// para nunca repetir o mesmo fundo em seguida.

import type { FeedBrand, FeedPalette } from "./feed";
import { contrastRatio, escapeHtml, formatRichText, htmlDocument, initials, relativeLuminance, safeColor, safeImageSrc, sizeByLength } from "./utils";

export const EDITORIAL_TELAS = [
  "capa-foto",
  "capa-impacto",
  "frase-imagem",
  "imagem-lista",
  "foto-texto",
  "passo",
  "respiro",
  "cta-comente",
  "revela",
  "checklist",
  "frase",
  "lacunas",
  "equacao",
] as const;
export type EditorialTela = (typeof EDITORIAL_TELAS)[number];

export const EDITORIAL_TELA_LABELS: Record<EditorialTela, string> = {
  "capa-foto": "Capa: foto + manchete",
  "capa-impacto": "Capa: impacto (caixa alta)",
  "frase-imagem": "Frase + imagem + apoio",
  "imagem-lista": "Imagem + lista com setas",
  "foto-texto": "Foto na tela toda + texto",
  passo: "Passo a passo (1)(2)(3)",
  respiro: "Frase serifada (respiro)",
  "cta-comente": "CTA: Comente PALAVRA",
  revela: "Lista que abre um item por tela",
  checklist: "Checklist",
  frase: "Citação numerada (FRASE 1)",
  lacunas: "Modelo para preencher [lacunas]",
  equacao: "Equação (A + B = resultado)",
};

/** O que cada campo significa em cada tela (texto de ajuda do editor). */
export const EDITORIAL_TELA_HINTS: Record<EditorialTela, { title: string; body: string | null; image: string | null }> = {
  "capa-foto": { title: "Manchete (use **trecho** para pintar o fim em destaque)", body: null, image: "Foto de fundo" },
  "capa-impacto": { title: "Manchete curta (sai em caixa alta)", body: null, image: "Foto de fundo (opcional)" },
  "frase-imagem": { title: "Frase principal", body: "Apoio (1 ou 2 frases)", image: "Imagem ou print (opcional)" },
  "imagem-lista": { title: "Frase que abre a lista", body: "Itens, um por linha. \"Rótulo: explicação\" pinta o rótulo.", image: "Imagem ou print em cima (opcional)" },
  "foto-texto": { title: "Frase principal", body: "Apoio (opcional)", image: "Foto de fundo" },
  passo: { title: "Frase que abre os passos", body: "Passos, um por linha (o último fica em destaque)", image: null },
  respiro: { title: "Frase de efeito (serifada)", body: "Apoio no pé da tela (use **negrito**)", image: null },
  "cta-comente": { title: "Frase do convite (use **trecho** em destaque)", body: "Linha embaixo da barra (ex.: e eu te mando o guia)", image: "Imagem do material (opcional)" },
  revela: { title: "Título da lista (ex.: Vale priorizar:)", body: "Itens, um por linha: \"Item: explicação\". O item aberto é o de \"Item aberto\".", image: null },
  checklist: { title: "O que revisar", body: "Itens, um por linha. \"Na legenda: descreva…\" pinta o começo.", image: null },
  frase: { title: "A frase (sai serifada e entre aspas)", body: "Comentário embaixo da linha", image: "Imagem (opcional)" },
  lacunas: { title: "Título (ex.: Frases para preencher)", body: "Uma frase por linha, com as lacunas [entre colchetes]", image: null },
  equacao: { title: "Frase que apresenta a ideia", body: "3 linhas: \"Parte A: explicação\", \"Parte B: explicação\" e \"= Resultado: explicação\"", image: null },
};

export const EDITORIAL_FUNDOS = ["auto", "claro", "escuro", "creme", "destaque", "foto"] as const;
export type EditorialFundo = (typeof EDITORIAL_FUNDOS)[number];
export const EDITORIAL_FUNDO_LABELS: Record<EditorialFundo, string> = {
  auto: "Automático (alterna)",
  claro: "Claro",
  escuro: "Escuro",
  creme: "Creme",
  destaque: "Cor de destaque",
  foto: "Foto",
};

/** Dados próprios de uma tela Editorial (título, apoio e imagem continuam no slide). */
export interface EditorialSlide {
  tela: EditorialTela;
  fundo?: EditorialFundo;
  /** Passo a passo: etiqueta acima dos passos (padrão "PASSO A PASSO"). */
  etiqueta?: string;
  /** CTA: a palavra que a pessoa comenta. */
  palavra?: string;
  /** Crédito da foto, em letra pequena sobre a imagem. */
  credito?: string;
  /** Fonte da informação, em letra pequena no pé da tela ("Fonte: Folha"). */
  fonte?: string;
  /** Lista que abre um item por tela: qual item está aberto (0, 1, 2...). */
  ativo?: number;
  /** Lista que abre um item por tela: "nao" (✕, o que evitar) ou "sim" (✓, o que fazer). */
  sinal?: "sim" | "nao";
}

/** Tokens do sistema (opcionais; o que faltar sai do kit do cliente). */
export interface EditorialTokens {
  /** Texto da faixa do topo, à esquerda (padrão: nome da marca). */
  esquerda?: string;
  /** Texto da faixa do topo, à direita (padrão: "ANO //"). */
  direita?: string;
  claro?: string;
  escuro?: string;
  creme?: string;
}

const W_PAD = 64; // margem lateral (6% de 1080)
const TOP = 118; // abaixo da faixa
const BOTTOM = 64;

function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/** Ajusta a cor de destaque até ter contraste mínimo sobre o fundo (clareia no escuro, escurece no claro). */
export function readableAccent(accent: string, bg: string, min = 3): string {
  const toward = relativeLuminance(bg) < 0.4 ? "#FFFFFF" : "#000000";
  let c = accent;
  for (let t = 0.08; contrastRatio(c, bg) < min && t <= 0.9; t += 0.08) c = mix(accent, toward, t);
  return c;
}

/** Fundo da tela no modo automático: capa escura (ou foto), fechamento claro, o meio alterna. */
export function editorialFundoAt(tela: EditorialTela, fundo: EditorialFundo | undefined, index: number, total: number, hasImage: boolean): Exclude<EditorialFundo, "auto"> {
  if (fundo && fundo !== "auto") return fundo === "foto" && !hasImage ? "escuro" : fundo;
  if ((tela === "capa-foto" || tela === "foto-texto" || tela === "capa-impacto") && hasImage) return "foto";
  if (tela === "respiro") return "creme";
  if (tela === "equacao") return "destaque";
  if (tela === "cta-comente" || (index === total - 1 && total > 1)) return "claro";
  if (index === 0) return "escuro";
  return index % 2 === 1 ? "claro" : "escuro";
}

export function editorialTokens(palette: FeedPalette, tokens: EditorialTokens | null | undefined) {
  const bg = safeColor(palette.background, "#FFFFFF");
  const text = safeColor(palette.text, "#16161A");
  const accent = safeColor(palette.accent, "#E8643A");
  const lightOf = [bg, text].find((c) => relativeLuminance(c) > 0.75);
  const darkOf = [bg, text].find((c) => relativeLuminance(c) < 0.04);
  const claro = safeColor(tokens?.claro, lightOf ? mix(lightOf, "#EDECE8", 0.55) : "#F2F1EE");
  const escuro = safeColor(tokens?.escuro, darkOf ?? "#0D0F18");
  const creme = safeColor(tokens?.creme, "#F7F4DF");
  return { claro, escuro, creme, accent };
}

function avatar(brand: FeedBrand, size: number, accent: string): string {
  const src = safeImageSrc(brand.logo);
  return src
    ? `<img class="av" src="${src}" alt="" style="width:${size}px;height:${size}px"/>`
    : `<span class="av" style="width:${size}px;height:${size}px;background:${accent};font-size:${Math.round(size * 0.38)}px">${escapeHtml(initials(brand.name))}</span>`;
}

/** Itens de lista: uma linha cada; "Rótulo: texto" separa o rótulo. */
export function editorialItems(body: string): { label: string; text: string }[] {
  return body
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-•*·–→]|\(?\d+[.)]\)?)\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((l) => {
      const m = /^([^:]{2,40}):\s+(.+)$/.exec(l);
      return m ? { label: m[1], text: m[2] } : { label: "", text: l };
    });
}

export function renderEditorialSlide(params: {
  ed: EditorialSlide;
  title: string;
  body: string;
  image: string | null | undefined;
  brand: FeedBrand;
  palette: FeedPalette;
  tokens: EditorialTokens | null | undefined;
  width: number;
  height: number;
  index: number;
  total: number;
  fontCss: string;
}): string {
  const { ed, brand, width, height, index, total } = params;
  const tela: EditorialTela = (EDITORIAL_TELAS as readonly string[]).includes(ed.tela) ? ed.tela : "frase-imagem";
  const photo = safeImageSrc(params.image);
  const tk = editorialTokens(params.palette, params.tokens);
  // Lista que abre um item por tela: o que evitar no escuro, o que fazer no claro (o tom muda junto com o sentido).
  const fundo = tela === "revela" && (!ed.fundo || ed.fundo === "auto") ? (ed.sinal === "nao" ? "escuro" : "claro") : editorialFundoAt(tela, ed.fundo, index, total, Boolean(photo));
  const usesPhotoBg = fundo === "foto" && (tela === "capa-foto" || tela === "capa-impacto" || tela === "foto-texto");
  const pageBg = fundo === "claro" ? tk.claro : fundo === "creme" ? tk.creme : fundo === "escuro" ? tk.escuro : fundo === "destaque" ? tk.accent : "#000000";
  const dark = fundo === "escuro" || usesPhotoBg || (fundo === "destaque" && relativeLuminance(tk.accent) <= 0.3);
  const ink = dark ? "#F6F6F4" : "#101114";
  const soft = dark ? "rgba(246,246,244,.72)" : "rgba(16,17,20,.66)";
  const line = dark ? "rgba(246,246,244,.28)" : "rgba(16,17,20,.22)";
  // No fundo da cor de destaque, o destaque do texto vira a própria cor da letra (com sublinhado).
  const onAccent = fundo === "destaque";
  const hl = onAccent ? ink : readableAccent(tk.accent, usesPhotoBg ? "#101114" : pageBg, 3.2);
  const cardBg = dark ? "rgba(255,255,255,.07)" : "#FFFFFF";
  const handle = brand.handle.trim().replace(/^@+/, "");
  const at = handle ? `@${handle}` : brand.name.trim();
  const esquerda = (params.tokens?.esquerda ?? brand.name).trim();
  const direita = (params.tokens?.direita ?? `${new Date().getFullYear()} //`).trim();
  const title = formatRichText(params.title);
  const hasTitle = Boolean(params.title.trim());
  const hasBody = Boolean(params.body.trim());
  const imgFrame = (minH: number, extra = "") =>
    photo
      ? `<figure class="img" style="min-height:${minH}px;${extra}"><img src="${photo}" alt=""/>${ed.credito ? `<figcaption>${escapeHtml(ed.credito)}</figcaption>` : ""}</figure>`
      : "";

  const tTitle = (steps: [number, number][], fallback: number) => sizeByLength(params.title.replace(/\*\*/g, ""), steps, fallback);
  const tBody = (steps: [number, number][], fallback: number) => sizeByLength(params.body.replace(/\*\*/g, ""), steps, fallback);
  // Sem imagem, o texto ganha um pouco mais de tamanho (a tela fica menos vazia).
  const boost = photo ? 1 : 1.12;

  let inner = "";
  switch (tela) {
    case "capa-foto": {
      const size = tTitle([[70, 80], [110, 70], [160, 62], [220, 54]], 48);
      inner = `<div class="col end">
        ${hasTitle ? `<h1 class="t" style="font-size:${size}px">${title}</h1>` : ""}
        <div class="chip">${avatar(brand, 52, tk.accent)}<span>${escapeHtml(at)}</span></div>
      </div>`;
      break;
    }
    case "capa-impacto": {
      const size = tTitle([[40, 168], [70, 140], [110, 118], [160, 100]], 88);
      inner = `<div class="col end center">
        <div class="chip">${avatar(brand, 52, tk.accent)}<span>${escapeHtml(at)}</span></div>
        ${hasTitle ? `<h1 class="t impact" style="font-size:${size}px">${title}</h1>` : ""}
      </div>`;
      break;
    }
    case "frase-imagem": {
      // Sem imagem a frase ganha a tela: maior e no meio, em vez de deixar um buraco embaixo.
      const solo = photo ? 1 : 1.22;
      const size = Math.round(tTitle([[80, 60], [140, 54], [200, 48], [280, 44]], 40) * boost * solo);
      const bsize = Math.round(tBody([[90, 40], [160, 36], [260, 33]], 30) * boost * (photo ? 1 : 1.08));
      inner = `<div class="col${photo ? "" : " mid"}">
        ${hasTitle ? `<h2 class="t" style="font-size:${size}px">${title}</h2>` : ""}
        ${photo ? imgFrame(300, "margin:44px 0") : `<div class="gap"></div>`}
        ${hasBody ? `<p class="s" style="font-size:${bsize}px">${formatRichText(params.body)}</p>` : ""}
      </div>`;
      break;
    }
    case "imagem-lista": {
      const items = editorialItems(params.body);
      const size = Math.round(tTitle([[60, 60], [110, 52], [170, 46]], 42) * (photo ? 0.92 : boost));
      const longest = Math.max(0, ...items.map((i) => i.label.length + i.text.length));
      const isz = Math.round((items.length <= 3 && longest <= 90 ? 38 : items.length <= 4 && longest <= 120 ? 34 : 30) * (photo ? 1 : 1.18));
      inner = `<div class="col">
        ${photo ? imgFrame(260, "margin-bottom:48px;flex:1 1 0") : ""}
        ${hasTitle ? `<h2 class="t" style="font-size:${size}px;margin-bottom:36px">${title}</h2>` : ""}
        <ul class="list${photo ? "" : " grow"}" style="font-size:${isz}px">
          ${items.map((it) => `<li><span class="arrow">→</span><span>${it.label ? `<b class="lab">${escapeHtml(it.label)}:</b> ` : ""}${formatRichText(it.text)}</span></li>`).join("")}
        </ul>
      </div>`;
      break;
    }
    case "foto-texto": {
      const size = tTitle([[80, 58], [140, 52], [200, 46]], 42);
      const bsize = tBody([[90, 40], [160, 36]], 32);
      inner = `<div class="col end">
        ${hasTitle ? `<h2 class="t" style="font-size:${size}px">${title}</h2>` : ""}
        ${hasBody ? `<p class="s" style="font-size:${bsize}px;margin-top:34px">${formatRichText(params.body)}</p>` : ""}
      </div>`;
      break;
    }
    case "passo": {
      const items = editorialItems(params.body);
      const size = tTitle([[60, 56], [110, 50], [170, 44]], 40);
      const longest = Math.max(0, ...items.map((i) => i.label.length + i.text.length));
      const isz = longest <= 70 ? 40 : longest <= 110 ? 36 : 32;
      const tag = (ed.etiqueta ?? "").trim() || "Passo a passo";
      inner = `<div class="col">
        ${hasTitle ? `<h2 class="t" style="font-size:${size}px">${title}</h2>` : ""}
        <div class="fill" style="min-height:40px;max-height:170px"></div>
        <div class="tag">${escapeHtml(tag)}</div>
        <ol class="steps" style="font-size:${isz}px">
          ${items.map((it, i) => `<li class="${i === items.length - 1 && items.length > 1 ? "last" : ""}"><span class="n">(${i + 1})</span><span>${it.label ? `<b>${escapeHtml(it.label)}:</b> ` : ""}${formatRichText(it.text)}</span></li>`).join("")}
        </ol>
      </div>`;
      break;
    }
    case "respiro": {
      const size = tTitle([[60, 104], [100, 90], [150, 78], [220, 66]], 58);
      const bsize = tBody([[120, 36], [220, 33]], 30);
      inner = `<div class="col">
        ${hasTitle ? `<h2 class="t serif" style="font-size:${size}px">${title}</h2>` : ""}
        <div class="fill"></div>
        ${hasBody ? `<p class="s plain" style="font-size:${bsize}px">${formatRichText(params.body)}</p>` : ""}
      </div>`;
      break;
    }
    case "cta-comente": {
      const size = tTitle([[70, 60], [120, 54], [180, 48]], 44);
      const palavra = (ed.palavra ?? "").trim().replace(/^["“]|["”]$/g, "").toUpperCase().slice(0, 18) || "QUERO";
      const psize = palavra.length <= 8 ? 64 : palavra.length <= 12 ? 54 : 44;
      inner = `<div class="col">
        ${hasTitle ? `<h2 class="t" style="font-size:${size}px">${title}</h2>` : ""}
        ${photo ? imgFrame(280, "margin:48px 0 44px;border-radius:26px;box-shadow:0 24px 60px rgba(0,0,0,.18)") : `<div class="fill"></div>`}
        <div class="bar">
          ${avatar(brand, 96, tk.accent)}
          <span class="lbl">Comente</span>
          <b class="word" style="font-size:${psize}px">${escapeHtml(palavra)}</b><i class="cursor"></i>
          <span class="go"><svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
        </div>
        ${hasBody ? `<p class="after">${formatRichText(params.body)}</p>` : ""}
        ${photo ? "" : `<div class="fill"></div>`}
      </div>`;
      break;
    }
    case "revela": {
      const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
      const items = editorialItems(params.body);
      const open = Math.min(Math.max(0, Math.round(ed.ativo ?? 0)), Math.max(0, items.length - 1));
      const size = tTitle([[30, 76], [60, 64], [110, 54]], 46);
      const icon = ed.sinal === "nao" ? '<path d="M8 8l8 8M16 8l-8 8"/>' : '<path d="M6.5 12.5l3.5 3.5 7.5-8"/>';
      const mark = (on: boolean) =>
        `<span class="ic${on ? " on" : ""}"><svg viewBox="0 0 24 24" width="${on ? 34 : 26}" height="${on ? 34 : 26}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></span>`;
      inner = `<div class="col">
        ${hasTitle ? `<h2 class="t" style="font-size:${size}px">${title}</h2>` : ""}
        <div style="height:150px;flex:none"></div>
        <div class="rev" style="--k:${items.length <= 2 ? 1.22 : items.length === 3 ? 1.1 : 1}">
          ${items
            .map((it, i) =>
              i === open
                ? `<div class="card">${mark(true)}<div><h3>${escapeHtml(it.label || it.text)}</h3>${it.label ? `<p>${formatRichText(cap(it.text))}</p>` : ""}</div></div>`
                : `<div class="off">${mark(false)}<span>${escapeHtml(it.label || it.text)}</span></div>`,
            )
            .join("")}
        </div>
        <div class="fill"></div>
      </div>`;
      break;
    }
    case "checklist": {
      const items = editorialItems(params.body);
      const size = tTitle([[40, 66], [80, 58], [130, 50]], 44);
      const longest = Math.max(0, ...items.map((i) => i.label.length + i.text.length));
      const isz = Math.round((longest <= 70 ? 40 : longest <= 110 ? 36 : 32) * (items.length <= 3 ? 1.15 : 1.05));
      inner = `<div class="col mid">
        ${hasTitle ? `<h2 class="t" style="font-size:${size}px;margin-bottom:44px">${title}</h2>` : ""}
        <ul class="check" style="font-size:${isz}px">
          ${items.map((it) => `<li><span class="box"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 12.5l3.5 3.5 7.5-8"/></svg></span><span>${it.label ? `<b class="lab">${escapeHtml(it.label)},</b> ` : ""}${formatRichText(it.text)}</span></li>`).join("")}
        </ul>
      </div>`;
      break;
    }
    case "frase": {
      const quote = params.title.trim().replace(/^["“]+|["”]+$/g, "");
      const size = sizeByLength(quote, [[60, 70], [110, 60], [170, 52], [240, 46]], 42);
      const tag = (ed.etiqueta ?? "").trim();
      inner = `<div class="col${photo ? "" : " mid"}">
        ${tag ? `<div class="kick">${escapeHtml(tag)}</div>` : ""}
        ${quote ? `<h2 class="t serif quote" style="font-size:${size}px"><span class="q">“</span>${formatRichText(quote)}<span class="q">”</span></h2>` : ""}
        ${photo ? imgFrame(280, "margin:40px 0 0") : ""}
        ${hasBody ? `<p class="s note" style="font-size:${tBody([[120, 32], [220, 29]], 27)}px">${formatRichText(params.body)}</p>` : ""}
      </div>`;
      break;
    }
    case "lacunas": {
      const lines = params.body.split("\n").map((l) => l.replace(/^\s*(?:[-•*·–→]|\(?\d+[.)]\)?)\s*/, "").trim()).filter(Boolean).slice(0, 5);
      const size = tTitle([[40, 58], [80, 52]], 46);
      const longest = Math.max(0, ...lines.map((l) => l.length));
      const isz = longest <= 60 ? 40 : longest <= 100 ? 36 : 32;
      const gap = (l: string) => formatRichText(l).replace(/\[([^\]]{1,60})\]/g, '<span class="blank">[$1]</span>');
      inner = `<div class="col">
        ${hasTitle ? `<h2 class="t" style="font-size:${size}px;margin-bottom:30px">${title}</h2>` : ""}
        <ol class="fill-in" style="font-size:${isz}px">
          ${lines.map((l, i) => `<li><span class="big">${i + 1}</span><span>${gap(l)}</span></li>`).join("")}
        </ol>
      </div>`;
      break;
    }
    case "equacao": {
      const parts = editorialItems(params.body.replace(/^\s*=\s*/gm, ""));
      const [a, b, r] = [parts[0], parts[1], parts[2]];
      const size = tTitle([[80, 58], [140, 50], [220, 44]], 40);
      const box = (it: { label: string; text: string } | undefined, cls: string) =>
        it ? `<div class="eq ${cls}"><h3>${escapeHtml(it.label || it.text)}</h3>${it.label ? `<p>${formatRichText(it.text.charAt(0).toUpperCase() + it.text.slice(1))}</p>` : ""}</div>` : "";
      inner = `<div class="col">
        ${hasTitle ? `<h2 class="t" style="font-size:${size}px">${title}</h2>` : ""}
        <div class="fill" style="min-height:50px"></div>
        <div class="eqrow">${box(a, "dk")}<span class="op">+</span>${box(b, "dk")}</div>
        ${r ? `<div class="op down">↓</div>${box(r, "lt")}` : ""}
        <div class="fill"></div>
      </div>`;
      break;
    }
  }

  const photoBg = usesPhotoBg && photo
    ? `<img class="bgimg" src="${photo}" alt=""/><div class="shade"></div>${ed.credito ? `<div class="credit">${escapeHtml(ed.credito)}</div>` : ""}`
    : "";

  const css = `
body{background:${pageBg};color:${ink};font-family:"Inter",Arial,sans-serif;position:relative}
.bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,9,14,.35) 0%,rgba(8,9,14,0) 18%,rgba(8,9,14,0) 38%,rgba(8,9,14,.78) 68%,rgba(8,9,14,.94) 100%)}
.credit{position:absolute;right:${W_PAD}px;bottom:20px;font-size:16px;color:rgba(255,255,255,.7)}
.faixa{position:absolute;top:42px;left:${W_PAD}px;right:${W_PAD}px;display:flex;align-items:center;font-size:21px;letter-spacing:-.01em;color:${ink};opacity:.88;z-index:2${tela === "cta-comente" ? `;border-bottom:2px solid ${line};padding-bottom:18px` : ""}}
.faixa span{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.faixa .c{text-align:center}.faixa .r{text-align:right}
.col{position:absolute;left:${W_PAD}px;right:${W_PAD}px;top:${TOP}px;bottom:${BOTTOM}px;display:flex;flex-direction:column;z-index:1}
.col.end{justify-content:flex-end}
.col.mid{justify-content:center}
.col.center{align-items:center;text-align:center}
.t{font-weight:700;letter-spacing:-.035em;line-height:1.07;color:${ink};overflow-wrap:break-word}
.t strong,.s strong{color:${hl};font-weight:inherit}
.t.impact{font-family:"Bebas Neue",Impact,sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:.005em;line-height:.93;margin-top:30px}
.t.serif{font-family:"Playfair Display",Georgia,serif;font-weight:400;letter-spacing:-.04em;line-height:1.02}
.t.serif strong{color:${ink};font-style:italic}
.s{color:${soft};font-weight:400;letter-spacing:-.025em;line-height:1.28}
.s.plain{color:${ink}}
.s.plain strong{color:${ink};font-weight:700}
.gap{height:40px;flex:none}
.fill{flex:1 1 0}
.img{position:relative;flex:1 1 0;overflow:hidden;border-radius:6px;background:rgba(127,127,127,.15)}
.img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.img figcaption{position:absolute;right:16px;bottom:12px;font-size:16px;color:rgba(255,255,255,.78);text-shadow:0 1px 6px rgba(0,0,0,.5)}
.chip{display:flex;align-items:center;gap:16px;font-size:30px;letter-spacing:-.02em;margin-top:30px;color:${ink}}
.col.center .chip{margin-top:0}
.av{border-radius:50%;object-fit:cover;flex:none;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-weight:700}
.list{list-style:none;border-top:2px solid ${line}}
.list.grow{flex:1 1 0;display:flex;flex-direction:column}
.list.grow li{flex:1 1 0;max-height:220px}
.list li{display:flex;gap:30px;align-items:center;padding:26px 0;border-bottom:2px solid ${line};letter-spacing:-.025em;line-height:1.2;font-weight:400}
.list .arrow{flex:none;width:44px;font-size:.9em}
.list .lab{color:${hl};font-weight:400}
.tag{font-family:"Cutive","Courier New",monospace;color:${hl};font-size:34px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:34px}
.steps{list-style:none;flex:1 1 0;display:flex;flex-direction:column;border-top:2px solid ${line};max-height:62%}
.steps li{flex:1 1 0;display:flex;gap:34px;align-items:center;border-bottom:2px solid ${line};letter-spacing:-.025em;line-height:1.2;padding:18px 0}
.steps .n{font-family:"Cutive","Courier New",monospace;color:${hl};flex:none;width:72px}
.steps li.last{color:${hl}}
.bar{display:flex;align-items:center;gap:22px;background:#FFFFFF;border-radius:999px;padding:14px 14px 14px 14px;box-shadow:0 18px 50px rgba(0,0,0,.14);flex:none}
.bar .lbl{font-size:44px;color:#9A9AA0;letter-spacing:-.03em}
.bar .word{color:${readableAccent(tk.accent, "#FFFFFF", 3.2)};font-weight:700;letter-spacing:-.04em}
.bar .cursor{width:5px;height:64px;background:${readableAccent(tk.accent, "#FFFFFF", 3.2)};margin-left:-14px}
.bar .go{margin-left:auto;width:96px;height:96px;border-radius:50%;background:${readableAccent(tk.accent, "#FFFFFF", 3)};display:inline-flex;align-items:center;justify-content:center;flex:none}
.after{text-align:center;font-size:36px;letter-spacing:-.03em;margin-top:34px;line-height:1.25}
.fonte{position:absolute;left:${W_PAD}px;bottom:22px;font-size:17px;color:${soft};z-index:2}
${onAccent ? `.t strong,.s strong{text-decoration:underline;text-decoration-thickness:4px;text-underline-offset:6px}` : ""}
.rev{display:flex;flex-direction:column;gap:calc(30px * var(--k,1))}
.rev .ic{display:inline-flex;align-items:center;justify-content:center;flex:none;border-radius:50%;color:${soft};border:2px solid ${line};width:52px;height:52px}
.rev .ic.on{width:72px;height:72px;border:none;background:${readableAccent(tk.accent, cardBg === "#FFFFFF" ? "#FFFFFF" : pageBg, 3)};color:#FFFFFF}
.rev .off{display:flex;align-items:center;gap:26px;font-size:calc(40px * var(--k,1));letter-spacing:-.025em;color:${soft};opacity:.8;padding:0 10px}
.rev .card{display:flex;gap:30px;align-items:flex-start;background:${cardBg};border-radius:26px;padding:calc(50px * var(--k,1)) 46px calc(54px * var(--k,1));${dark ? "" : "box-shadow:0 14px 40px rgba(0,0,0,.08);"}}
.rev .card h3{font-size:calc(62px * var(--k,1));font-weight:700;letter-spacing:-.035em;line-height:1.06;color:${dark ? "#F6F6F4" : "#101114"};margin-bottom:22px;margin-top:2px}
.rev .card p{font-size:calc(38px * var(--k,1));line-height:1.3;letter-spacing:-.02em;color:${dark ? "rgba(246,246,244,.76)" : "rgba(16,17,20,.72)"}}
.check{list-style:none;border-top:2px solid ${line}}
.check li{display:flex;gap:28px;align-items:flex-start;padding:30px 0;border-bottom:2px solid ${line};letter-spacing:-.025em;line-height:1.22}
.check .box{flex:none;width:48px;height:48px;border-radius:8px;background:${readableAccent(tk.accent, pageBg, 3)};color:#FFFFFF;display:inline-flex;align-items:center;justify-content:center;margin-top:-2px}
.check .lab{color:${hl};font-weight:400}
.kick{font-size:28px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${hl};margin-bottom:26px}
.t.quote .q{color:${hl};font-style:normal}
.note{border-top:2px solid ${line};padding-top:30px;margin-top:40px}
.fill-in{list-style:none;flex:1 1 0;display:flex;flex-direction:column;border-top:2px solid ${line};max-height:78%}
.fill-in li{flex:1 1 0;display:flex;gap:40px;align-items:center;border-bottom:2px solid ${line};letter-spacing:-.025em;line-height:1.25;max-height:230px}
.fill-in .big{font-size:2em;font-weight:700;color:${hl};width:60px;flex:none;letter-spacing:-.04em}
.blank{color:${hl};text-decoration:underline;text-decoration-thickness:3px;text-underline-offset:7px}
.eqrow{display:flex;align-items:stretch;gap:18px}
.eq{border-radius:24px;padding:42px 38px;display:flex;flex-direction:column}
.eq.dk{flex:1 1 0;background:${tk.escuro};color:#F6F6F4;min-height:440px}
.eq.lt{background:#FFFFFF;color:#101114;text-align:center;align-items:center}
.eq h3{font-size:54px;font-weight:700;letter-spacing:-.035em;line-height:1.05}
.eq.dk p{margin-top:auto;padding-top:26px;font-size:32px;line-height:1.28;color:rgba(246,246,244,.78)}
.eq.lt p{margin-top:16px;font-size:33px;line-height:1.28;color:rgba(16,17,20,.7)}
.op{align-self:center;font-size:64px;font-weight:700;color:${ink}}
.op.down{text-align:center;margin:14px 0}
`;

  const body = `${photoBg}
<div class="faixa"><span>${escapeHtml(esquerda)}</span><span class="c">${escapeHtml(at)}</span><span class="r">${escapeHtml(direita)}</span></div>
${inner}
${ed.fonte?.trim() ? `<div class="fonte">Fonte: ${escapeHtml(ed.fonte.trim().replace(/^fonte:\s*/i, ""))}</div>` : ""}`;
  return htmlDocument({ width, height, fontCss: params.fontCss, css, body });
}
