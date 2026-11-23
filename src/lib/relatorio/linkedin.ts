// LinkedIn no relatório do cliente: soma os números por dia (linkedin_dias) do período e do anterior,
// e escolhe os posts das páginas com mais impressões. Funções puras (o servidor busca as linhas).

import type { Kpi, LinkedinPeriodo } from "./tipos";

export interface DiaLinkedin {
  fonte_urn: string;
  data: string;
  impressoes: number | null;
  reacoes: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  cliques: number | null;
  novos_seguidores: number | null;
  seguidores: number | null;
  visualizacoes_pagina: number | null;
}

export interface PostLinkedin {
  post_urn: string;
  publicado_em: string | null;
  texto: string | null;
  impressoes: number | null;
  reacoes: number | null;
  comentarios: number | null;
  compartilhamentos: number | null;
  cliques: number | null;
}

export interface FonteLinkedin {
  urn: string;
  nome: string;
  tipo: "pagina" | "perfil";
}

type Campo = "impressoes" | "reacoes" | "comentarios" | "compartilhamentos" | "cliques" | "novos_seguidores" | "visualizacoes_pagina";

/** Soma um campo nas linhas do intervalo [de, ate]. Null quando nenhuma linha do intervalo tem o campo. */
export function somaCampo(dias: DiaLinkedin[], campo: Campo, de: string, ate: string): number | null {
  let total: number | null = null;
  for (const d of dias) {
    if (d.data < de || d.data > ate) continue;
    const v = d[campo];
    if (typeof v === "number") total = (total ?? 0) + v;
  }
  return total;
}

/** Seguidores de cada fonte na última leitura até `ate` (inclusive), somados. */
export function seguidoresAte(dias: DiaLinkedin[], ate: string): number | null {
  const ultimo = new Map<string, { data: string; n: number }>();
  for (const d of dias) {
    if (typeof d.seguidores !== "number" || d.data > ate) continue;
    const atual = ultimo.get(d.fonte_urn);
    if (!atual || d.data > atual.data) ultimo.set(d.fonte_urn, { data: d.data, n: d.seguidores });
  }
  if (!ultimo.size) return null;
  return [...ultimo.values()].reduce((s, x) => s + x.n, 0);
}

const temDados = (dias: DiaLinkedin[], de: string, ate: string) =>
  dias.some((d) => d.data >= de && d.data <= ate && (d.impressoes !== null || d.reacoes !== null || d.novos_seguidores !== null));

const interacoesDe = (x: { reacoes: number | null; comentarios: number | null; compartilhamentos: number | null; cliques: number | null }) =>
  (x.reacoes ?? 0) + (x.comentarios ?? 0) + (x.compartilhamentos ?? 0) + (x.cliques ?? 0);

/** Link público de um post (urn:li:share:… ou urn:li:ugcPost:…). */
export const linkDoPost = (urn: string) => `https://www.linkedin.com/feed/update/${urn}/`;

export function linkedinDoPeriodo(input: {
  fontes: FonteLinkedin[];
  dias: DiaLinkedin[];
  posts: PostLinkedin[];
  periodo: { inicio: string; fim: string };
  anterior: { inicio: string; fim: string };
  /** Dia seguinte ao fim: a leitura de seguidores do dia em que o relatório sai ainda vale. */
  leituraAte: string;
}): LinkedinPeriodo | null {
  const { fontes, dias, posts, periodo: p, anterior: a } = input;
  if (!fontes.length || !temDados(dias, p.inicio, p.fim)) return null;
  const comAnterior = temDados(dias, a.inicio, a.fim);
  const k = (campo: Campo): Kpi => ({ valor: somaCampo(dias, campo, p.inicio, p.fim), anterior: comAnterior ? somaCampo(dias, campo, a.inicio, a.fim) : null });
  const temPagina = fontes.some((f) => f.tipo === "pagina");

  const taxa = (de: string, ate: string) => {
    const imp = somaCampo(dias, "impressoes", de, ate);
    if (!imp) return null;
    const inter =
      (somaCampo(dias, "reacoes", de, ate) ?? 0) +
      (somaCampo(dias, "comentarios", de, ate) ?? 0) +
      (somaCampo(dias, "compartilhamentos", de, ate) ?? 0) +
      (somaCampo(dias, "cliques", de, ate) ?? 0);
    return Math.round((inter / imp) * 1000) / 10;
  };

  const doPeriodo = posts
    .filter((x) => x.publicado_em && x.publicado_em.slice(0, 10) >= p.inicio && x.publicado_em.slice(0, 10) <= p.fim)
    .sort((x, y) => (y.impressoes ?? 0) - (x.impressoes ?? 0))
    .slice(0, 3)
    .map((x) => ({
      texto: (x.texto ?? "").slice(0, 220),
      publicado_em: x.publicado_em!,
      impressoes: x.impressoes ?? 0,
      interacoes: interacoesDe(x),
      link: linkDoPost(x.post_urn),
    }));

  const ate = dias.filter((d) => d.data <= p.fim && d.impressoes !== null).reduce<string | null>((m, d) => (!m || d.data > m ? d.data : m), null);

  return {
    fontes: fontes.map((f) => ({ nome: f.nome, tipo: f.tipo })),
    seguidores: seguidoresAte(dias, input.leituraAte),
    novos_seguidores: k("novos_seguidores"),
    impressoes: k("impressoes"),
    reacoes: k("reacoes"),
    comentarios: k("comentarios"),
    compartilhamentos: k("compartilhamentos"),
    cliques: temPagina ? k("cliques") : null,
    visualizacoes_pagina: temPagina ? k("visualizacoes_pagina") : null,
    engajamento: { valor: taxa(p.inicio, p.fim), anterior: comAnterior ? taxa(a.inicio, a.fim) : null },
    posts: doPeriodo,
    ate,
  };
}
