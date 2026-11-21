// Do carrossel que a IA escreveu (tipo, título, texto, etiqueta) para as telas do layout Editorial.
// Etapa 1: a escolha do tipo de tela é por regra (posição, tipo e forma do texto). Na etapa 2 a IA
// passa a escolher o roteiro e o tipo de cada tela.

import type { EditorialSlide, EditorialTela } from "../templates/editorial";

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
