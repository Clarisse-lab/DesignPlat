// Do carrossel que a IA escreveu (tipo, título, texto, etiqueta) para as telas do layout Editorial.
// Etapa 1: a escolha do tipo de tela é por regra (posição, tipo e forma do texto). Na etapa 2 a IA
// passa a escolher o roteiro e o tipo de cada tela.

import type { EditorialSlide, EditorialTela } from "../templates/editorial";
import { EDITORIAL_TELAS } from "../templates/editorial";

export interface GeneratedLike {
  tipo: string;
  etiqueta?: string;
  titulo: string;
  texto: string;
}

export interface EditorialMapped {
  title: string;
  body: string;
  editorial: EditorialSlide;
  /** A tela usa foto (de fundo ou emoldurada). */
  foto: boolean;
  /** Onde fica o texto sobre a foto, para a IA deixar a área livre. */
  zone: "inferior" | "nenhuma";
}

const STEP_WORDS = /^(acesse|abra|copie|pe[çc]a|fa[çc]a|escolha|defina|liste|anote|comece|separe|marque|envie|crie|revise|teste|use|pergunte|confira|monte)\b/i;
const COMMENT = /coment[ea](?:r|m)?\s+(?:a\s+palavra\s+)?["“'‘]?([A-Za-zÀ-ÿ0-9]{3,18})["”'’]?/i;

/** Palavra do CTA: "Comente GUIA…" no texto ou no título; senão a etiqueta curta; senão QUERO. */
export function ctaWord(it: GeneratedLike): string {
  const m = COMMENT.exec(`${it.titulo}\n${it.texto}`);
  if (m) return m[1].toUpperCase();
  const tag = (it.etiqueta ?? "").trim();
  if (/^[A-Za-zÀ-ÿ0-9]{3,18}$/.test(tag)) return tag.toUpperCase();
  return "QUERO";
}

/** Tira do apoio a frase "Comente X…" (a barra já mostra a palavra). */
function withoutCommentSentence(text: string): string {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((p) => !COMMENT.test(p))
    .join(" ")
    .trim();
}

const lines = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

export function mapToEditorial(it: GeneratedLike, k: number, total: number, photoAvailable: boolean): EditorialMapped {
  const make = (tela: EditorialTela, body: string, extra: Partial<EditorialSlide> = {}, foto = false): EditorialMapped => ({
    title: it.titulo.trim(),
    body: body.trim(),
    editorial: { tela, fundo: "auto", ...extra },
    foto: foto && photoAvailable,
    zone: tela === "capa-foto" || tela === "foto-texto" || tela === "capa-impacto" ? "inferior" : "nenhuma",
  });

  if (k === 0) return photoAvailable ? make("capa-foto", "", {}, true) : make("capa-impacto", "");
  if (it.tipo === "cta" || (k === total - 1 && total > 2)) {
    const body = withoutCommentSentence(it.texto);
    return make("cta-comente", body.length <= 140 ? body : "", { palavra: ctaWord(it) });
  }
  const ls = lines(it.texto);
  if (it.tipo === "lista" && ls.length >= 2) {
    const steps = ls.filter((l) => STEP_WORDS.test(l.replace(/^\s*(?:[-•*·–→]|\(?\d+[.)]\)?)\s*/, ""))).length;
    if (steps >= Math.ceil(ls.length / 2) && ls.length <= 5) return make("passo", ls.join("\n"), { etiqueta: (it.etiqueta ?? "").trim().slice(0, 40) || undefined });
    return make("imagem-lista", ls.join("\n"), {}, true);
  }
  if (it.tipo === "citacao") return make("respiro", it.texto);
  // Telas de texto: alterna foto na tela toda e frase com imagem, para o carrossel ter ritmo.
  if (photoAvailable && k % 3 === 1) return make("foto-texto", it.texto, {}, true);
  return make("frase-imagem", it.texto, {}, true);
}

export interface EditorialRawSlide {
  tela: EditorialTela;
  etiqueta: string;
  titulo: string;
  texto: string;
  palavra: string;
  fonte: string;
  sinal: "" | "sim" | "nao";
  imagem: string;
  rosto: boolean;
}

export interface EditorialGeneratedSlide {
  tipo: "capa" | "texto" | "lista" | "citacao" | "cta";
  tela: EditorialTela;
  etiqueta: string;
  titulo: string;
  texto: string;
  palavra: string;
  fonte: string;
  sinal: "" | "sim" | "nao";
  ativo: number;
  imagem: string;
  rosto: boolean;
}

const TIPO: Partial<Record<EditorialTela, EditorialGeneratedSlide["tipo"]>> = {
  "capa-foto": "capa",
  "capa-impacto": "capa",
  "cta-comente": "cta",
  "imagem-lista": "lista",
  passo: "lista",
  checklist: "lista",
  lacunas: "lista",
  frase: "citacao",
  respiro: "citacao",
};

/** Uma tela 'revela' vira uma tela por item (o item da vez aberto); o resto passa como veio. */
export function expandEditorial(slides: EditorialRawSlide[], max = 14): EditorialGeneratedSlide[] {
  const out: EditorialGeneratedSlide[] = [];
  for (const s of slides) {
    const base: EditorialGeneratedSlide = {
      tipo: TIPO[s.tela] ?? "texto",
      tela: s.tela,
      etiqueta: s.etiqueta.trim(),
      titulo: s.titulo.trim(),
      texto: s.texto.trim(),
      palavra: s.palavra.trim().toUpperCase(),
      fonte: s.fonte.trim(),
      sinal: s.sinal,
      ativo: 0,
      imagem: s.imagem.trim(),
      rosto: s.rosto,
    };
    if (s.tela === "revela") {
      const n = Math.min(4, Math.max(1, s.texto.split("\n").filter((l) => l.trim()).length));
      for (let k = 0; k < n; k++) out.push({ ...base, ativo: k, sinal: base.sinal || "sim", fonte: k === 0 ? base.fonte : "" });
    } else out.push(base);
  }
  return out.slice(0, max);
}


/** Telas que só funcionam com foto: sem foto, viram a versão sem foto mais próxima. */
const NEEDS_PHOTO: Partial<Record<EditorialTela, EditorialTela>> = { "capa-foto": "capa-impacto", "foto-texto": "frase-imagem" };
const TAKES_PHOTO = new Set<EditorialTela>(["capa-foto", "foto-texto", "frase-imagem", "imagem-lista", "frase", "cta-comente"]);

/** Tela escrita pela IA já com o tipo: aplica a regra da foto e monta o slide Editorial. */
export function fromGeneratedEditorial(
  it: { tela?: string; titulo: string; texto: string; etiqueta?: string; palavra?: string; fonte?: string; sinal?: string; ativo?: number },
  photoAvailable: boolean,
): EditorialMapped | null {
  if (!it.tela || !(EDITORIAL_TELAS as readonly string[]).includes(it.tela)) return null;
  let tela = it.tela as EditorialTela;
  if (!photoAvailable && NEEDS_PHOTO[tela]) tela = NEEDS_PHOTO[tela]!;
  const foto = photoAvailable && TAKES_PHOTO.has(tela);
  const ed: EditorialSlide = { tela, fundo: "auto" };
  const etiqueta = (it.etiqueta ?? "").trim();
  if (etiqueta && (tela === "passo" || tela === "frase")) ed.etiqueta = etiqueta.slice(0, 40);
  if (tela === "cta-comente") ed.palavra = ((it.palavra ?? "").trim() || "QUERO").toUpperCase().slice(0, 18);
  if (it.fonte?.trim()) ed.fonte = it.fonte.trim().slice(0, 90);
  if (tela === "revela") {
    ed.ativo = Math.max(0, Math.min(9, Math.round(it.ativo ?? 0)));
    ed.sinal = it.sinal === "nao" ? "nao" : "sim";
  }
  return {
    title: it.titulo.trim(),
    body: it.texto.trim(),
    editorial: ed,
    foto,
    zone: tela === "capa-foto" || tela === "foto-texto" ? "inferior" : "nenhuma",
  };
}
