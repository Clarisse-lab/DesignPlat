import "server-only";
// Desempenho dos posts: cruza as métricas do Instagram (vw_ig_posts_desempenho, coletadas todo dia)
// com as peças feitas aqui (design_pecas.post_media_id), para ver o que funciona em cada cliente.
// Nota = (salvamentos + compartilhamentos) por mil de alcance: o sinal de conteúdo que vale guardar.

import { rest } from "./supabase";

export interface PostDesempenho {
  media_id: string;
  publicado_em: string;
  tipo: string;
  produto: string | null;
  permalink: string | null;
  legenda: string | null;
  alcance: number | null;
  salvamentos: number | null;
  compartilhamentos: number | null;
  curtidas: number | null;
  comentarios: number | null;
}

export interface PecaPublicavel {
  id: string;
  titulo: string;
  criado_em: string;
  post_media_id: string | null;
  post_vinculo: "auto" | "manual" | null;
  legenda: string | null;
  estilo: { id: string; nome: string } | null;
  capa_motion: unknown;
}

export const nota = (p: Pick<PostDesempenho, "alcance" | "salvamentos" | "compartilhamentos">): number | null =>
  p.alcance && p.alcance > 0 ? Math.round((((p.salvamentos ?? 0) + (p.compartilhamentos ?? 0)) * 10000) / p.alcance) / 10 : null;

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const avg = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export async function loadPosts(cliente: string, dias = 120): Promise<PostDesempenho[]> {
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  return rest(
    `vw_ig_posts_desempenho?cliente_slug=eq.${cliente}&publicado_em=gte.${desde}` +
      "&select=media_id,publicado_em,tipo,produto,permalink,legenda,alcance,salvamentos,compartilhamentos,curtidas,comentarios&order=publicado_em.desc&limit=500",
  );
}

export async function loadPecas(cliente: string): Promise<PecaPublicavel[]> {
  return rest(
    `design_pecas?cliente_slug=eq.${cliente}&ferramenta=eq.feed&template=is.false` +
      "&select=id,titulo,criado_em,post_media_id,post_vinculo,legenda:dados->>legenda,estilo:dados->estilo,capa_motion:dados->slides->0->free->motion&order=criado_em.desc&limit=200",
  );
}

/** Palavras de uma legenda, para comparar (sem acento, hashtag, emoji, pontuação). */
function words(text: string): Set<string> {
  return new Set(
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/#\S+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 80),
  );
}

export function similarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

/**
 * Liga sozinho peça → post quando a legenda publicada é quase a da peça (60% das palavras da menor)
 * e o post saiu depois da peça (até 60 dias). Um post só pode ser de uma peça.
 */
export function autoMatches(pecas: PecaPublicavel[], posts: PostDesempenho[]): { peca_id: string; media_id: string }[] {
  const taken = new Set(pecas.map((p) => p.post_media_id).filter(Boolean) as string[]);
  const out: { peca_id: string; media_id: string }[] = [];
  for (const peca of pecas) {
    if (peca.post_media_id || !peca.legenda || peca.legenda.trim().length < 40) continue;
    const created = Date.parse(peca.criado_em);
    let best: { media_id: string; score: number } | null = null;
    for (const post of posts) {
      if (taken.has(post.media_id) || !post.legenda) continue;
      const t = Date.parse(post.publicado_em);
      if (t < created - 86_400_000 || t > created + 60 * 86_400_000) continue;
      const score = similarity(peca.legenda, post.legenda);
      if (score >= 0.6 && (!best || score > best.score)) best = { media_id: post.media_id, score };
    }
    if (best) {
      taken.add(best.media_id);
      out.push({ peca_id: peca.id, media_id: best.media_id });
    }
  }
  return out;
}

export async function linkPeca(pecaId: string, mediaId: string | null, vinculo: "auto" | "manual"): Promise<void> {
  await rest(`design_pecas?id=eq.${pecaId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ post_media_id: mediaId, post_vinculo: mediaId ? vinculo : null }),
  });
}

const TIPO_LABEL: Record<string, string> = { CAROUSEL_ALBUM: "Carrossel", VIDEO: "Reels / vídeo", IMAGE: "Foto" };

/** Monta o resumo do cliente: formatos, estilos da plataforma, capa animada e os melhores carrosséis. */
export function summarize(posts: PostDesempenho[], pecas: PecaPublicavel[]) {
  const withNota = posts.map((p) => ({ ...p, nota: nota(p) }));
  const notas = withNota.map((p) => p.nota).filter((n): n is number => n !== null);
  const mediana = median(notas);
  const byMedia = new Map(withNota.map((p) => [p.media_id, p]));

  const formatos = Object.entries(
    withNota.reduce<Record<string, typeof withNota>>((acc, p) => {
      (acc[p.tipo] ??= []).push(p);
      return acc;
    }, {}),
  )
    .map(([tipo, list]) => ({
      tipo: TIPO_LABEL[tipo] ?? tipo,
      posts: list.length,
      alcance: avg(list.map((p) => p.alcance ?? 0)),
      nota: avg(list.map((p) => p.nota).filter((n): n is number => n !== null)),
    }))
    .sort((a, b) => b.posts - a.posts);

  const publicadas = pecas
    .filter((p) => p.post_media_id && byMedia.has(p.post_media_id))
    .map((p) => {
      const post = byMedia.get(p.post_media_id!)!;
      return {
        peca_id: p.id,
        titulo: p.titulo,
        estilo: p.estilo?.nome ?? "Sem estilo de referência",
        capa_animada: Boolean(p.capa_motion),
        vinculo: p.post_vinculo,
        media_id: post.media_id,
        permalink: post.permalink,
        publicado_em: post.publicado_em,
        alcance: post.alcance,
        nota: post.nota,
      };
    });

  const group = (key: (x: (typeof publicadas)[number]) => string) =>
    Object.entries(
      publicadas.reduce<Record<string, number[]>>((acc, x) => {
        if (x.nota !== null) (acc[key(x)] ??= []).push(x.nota);
        return acc;
      }, {}),
    )
      .map(([nome, ns]) => ({ nome, posts: ns.length, nota: avg(ns), vs_mediana: mediana && avg(ns) !== null ? Math.round(((avg(ns)! - mediana) / mediana) * 100) : null }))
      .sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0));

  const carrosseis = withNota.filter((p) => p.tipo === "CAROUSEL_ALBUM" && p.nota !== null);
  const linkedBy = new Map(pecas.filter((p) => p.post_media_id).map((p) => [p.post_media_id!, p]));
  const melhores = [...carrosseis]
    .sort((a, b) => (b.nota ?? 0) - (a.nota ?? 0))
    .slice(0, 12)
    .map((p) => ({
      media_id: p.media_id,
      permalink: p.permalink,
      publicado_em: p.publicado_em,
      legenda: (p.legenda ?? "").split("\n")[0].slice(0, 140),
      alcance: p.alcance,
      salvamentos: p.salvamentos,
      compartilhamentos: p.compartilhamentos,
      nota: p.nota,
      peca: linkedBy.get(p.media_id) ? { id: linkedBy.get(p.media_id)!.id, estilo: linkedBy.get(p.media_id)!.estilo?.nome ?? null } : null,
    }));

  // Peças sem post ligado (para ligar à mão) e os carrosséis publicados que ainda não têm peça.
  const pendentes = pecas.filter((p) => !p.post_media_id).slice(0, 30).map((p) => ({ id: p.id, titulo: p.titulo, criado_em: p.criado_em }));
  const livres = carrosseis
    .filter((p) => !linkedBy.has(p.media_id))
    .slice(0, 40)
    .map((p) => ({ media_id: p.media_id, publicado_em: p.publicado_em, legenda: (p.legenda ?? "").split("\n")[0].slice(0, 90) }));

  return {
    mediana,
    formatos,
    estilos: group((x) => x.estilo),
    capa: group((x) => (x.capa_animada ? "Capa animada" : "Capa parada")),
    publicadas,
    melhores,
    pendentes,
    livres,
  };
}
