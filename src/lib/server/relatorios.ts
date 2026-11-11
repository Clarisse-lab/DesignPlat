import "server-only";
// Relatório semanal do cliente: coleta os números da semana (Instagram, leads, peças aprovadas),
// guarda as capas dos melhores posts no bucket (o link da Meta expira) e lê/grava os relatórios.

import { randomBytes } from "node:crypto";
import {
  coletaDaSemana,
  formato,
  intervaloUtc,
  kpi,
  melhores,
  novosSeguidores,
  porFormato,
  seguidoresEm,
  somaDias,
  totais,
} from "../relatorio/calc";
import type { DadosSemana, PostSemana, RelatorioSemana } from "../relatorio/tipos";
import { callFunction, rest, signObjects, uploadObject } from "./supabase";

const COLS =
  "id,cliente_slug,semana_inicio,semana_fim,status,dados,textos,trafego,entregas,secoes,notas,publicado_em,atualizado_em,atualizado_por,visualizacoes";

interface Conta {
  ig_user_id: string;
  username: string;
  seguidores: number | null;
}
interface PostRow {
  media_id: string;
  ig_user_id: string;
  publicado_em: string;
  tipo: string;
  produto: string | null;
  permalink: string | null;
  legenda: string | null;
}
interface MetricaRow {
  media_id: string;
  data: string;
  alcance: number | null;
  salvamentos: number | null;
  compartilhamentos: number | null;
  visualizacoes: number | null;
  interacoes: number | null;
}

const inList = (ids: string[]) => `(${ids.map((i) => `"${i}"`).join(",")})`;
const curta = (t: string | null) => (t ?? "").replace(/\s+/g, " ").trim().slice(0, 220);

/** Posts de um intervalo, medidos na coleta da semana (a mesma régua para a semana e a anterior). */
async function postsDaSemana(contas: Conta[], inicio: string, fim: string): Promise<{ lista: PostSemana[]; medido_em: string | null; parcial: boolean }> {
  const { de, ate } = intervaloUtc(inicio);
  const posts = await rest<PostRow[]>(
    `ig_posts?ig_user_id=in.${inList(contas.map((c) => c.ig_user_id))}&publicado_em=gte.${de}&publicado_em=lt.${ate}` +
      "&select=media_id,ig_user_id,publicado_em,tipo,produto,permalink,legenda&order=publicado_em.asc&limit=200",
  );
  if (!posts.length) return { lista: [], medido_em: null, parcial: false };
  const metricas = await rest<MetricaRow[]>(
    `ig_metricas?media_id=in.${inList(posts.map((p) => p.media_id))}&select=media_id,data,alcance,salvamentos,compartilhamentos,visualizacoes,interacoes&limit=2000`,
  );
  const { data: medido_em, parcial } = coletaDaSemana(fim, metricas.map((m) => m.data));
  const porPost = new Map<string, MetricaRow>();
  for (const m of metricas) {
    // A coleta da semana; se o post ainda não tem essa coleta, a mais próxima antes dela.
    if (medido_em && m.data > medido_em) continue;
    const atual = porPost.get(m.media_id);
    if (!atual || m.data > atual.data) porPost.set(m.media_id, m);
  }
  const lista: PostSemana[] = posts.map((p) => {
    const m = porPost.get(p.media_id);
    return {
      media_id: p.media_id,
      publicado_em: p.publicado_em,
      formato: formato(p.tipo, p.produto),
      legenda: curta(p.legenda),
      permalink: p.permalink,
      alcance: m?.alcance ?? null,
      interacoes: m?.interacoes ?? null,
      salvamentos: m?.salvamentos ?? null,
      compartilhamentos: m?.compartilhamentos ?? null,
      visualizacoes: m?.visualizacoes ?? null,
      capa: null,
    };
  });
  return { lista, medido_em, parcial };
}

async function instagram(cliente: string, inicio: string, fim: string): Promise<DadosSemana["instagram"]> {
  const contas = await rest<Conta[]>(`ig_contas?cliente_slug=eq.${cliente}&monitorar=is.true&select=ig_user_id,username,seguidores`);
  if (!contas.length) return null;
  const anteriorInicio = somaDias(inicio, -7);
  const [atual, anterior, pontos] = await Promise.all([
    postsDaSemana(contas, inicio, fim),
    postsDaSemana(contas, anteriorInicio, somaDias(inicio, -1)),
    rest<{ ig_user_id: string; data: string; seguidores: number }[]>(
      `ig_seguidores?ig_user_id=in.${inList(contas.map((c) => c.ig_user_id))}&data=gte.${somaDias(inicio, -14)}&select=ig_user_id,data,seguidores&order=data.asc`,
    ),
  ]);
  const serie = pontos.map((p) => ({ conta: p.ig_user_id, data: p.data, seguidores: p.seguidores }));
  const t = totais(atual.lista);
  const a = totais(anterior.lista);
  return {
    contas: contas.map((c) => c.username),
    seguidores: seguidoresEm(serie, somaDias(fim, 1)) ?? contas.reduce((s, c) => s + (c.seguidores ?? 0), 0),
    novos_seguidores: kpi(novosSeguidores(serie, inicio, fim), novosSeguidores(serie, anteriorInicio, somaDias(inicio, -1))),
    posts: kpi(t.posts, a.posts),
    alcance: kpi(t.alcance, anterior.lista.length ? a.alcance : null),
    interacoes: kpi(t.interacoes, anterior.lista.length ? a.interacoes : null),
    salvos_compart: kpi(t.salvos_compart, anterior.lista.length ? a.salvos_compart : null),
    visualizacoes: kpi(t.visualizacoes, anterior.lista.length ? a.visualizacoes : null),
    lista: atual.lista,
    melhores: melhores(atual.lista),
    formatos: porFormato(atual.lista),
    medido_em: atual.medido_em,
    parcial: atual.parcial,
  };
}

async function leads(cliente: string, inicio: string): Promise<DadosSemana["leads"]> {
  const fontes = await rest<{ planilha_id: string }[]>(`leads_fontes?cliente=eq.${cliente}&select=planilha_id&limit=1`);
  if (!fontes.length) return null;
  const { de, ate } = intervaloUtc(inicio);
  const anterior = intervaloUtc(somaDias(inicio, -7));
  // Só contagem e origem: nome, e-mail e telefone nunca saem do banco para o relatório.
  const rows = await rest<{ recebido_em: string; utm_source: string | null }[]>(
    `leads?cliente=eq.${cliente}&recebido_em=gte.${anterior.de}&recebido_em=lt.${ate}&select=recebido_em,utm_source&limit=5000`,
  );
  const semana = rows.filter((r) => r.recebido_em >= de);
  const origens = new Map<string, number>();
  for (const r of semana) {
    const o = normalizaOrigem(r.utm_source);
    origens.set(o, (origens.get(o) ?? 0) + 1);
  }
  return {
    total: kpi(semana.length, rows.length - semana.length),
    origens: [...origens.entries()].map(([origem, total]) => ({ origem, total })).sort((a, b) => b.total - a.total),
  };
}

function normalizaOrigem(utm: string | null): string {
  const s = (utm ?? "").toLowerCase();
  if (!s) return "Direto / orgânico";
  if (/^(ig|instagram)/.test(s)) return "Instagram";
  if (/^(fb|facebook|meta)/.test(s)) return "Facebook / Meta";
  if (/google/.test(s)) return "Google";
  if (/whats/.test(s)) return "WhatsApp";
  if (/you/.test(s)) return "YouTube";
  return utm!.slice(0, 30);
}

async function aprovadas(cliente: string, inicio: string): Promise<DadosSemana["aprovadas"]> {
  const { de, ate } = intervaloUtc(inicio);
  const rows = await rest<{ titulo: string; respondido_em: string }[]>(
    `design_aprovacoes?cliente_slug=eq.${cliente}&status=eq.aprovado&respondido_em=gte.${de}&respondido_em=lt.${ate}&select=titulo,respondido_em&order=respondido_em.asc`,
  );
  return rows.map((r) => ({ titulo: r.titulo, em: r.respondido_em }));
}

/** Baixa as capas dos melhores posts (e a foto de perfil) e guarda no bucket. */
async function guardarImagens(cliente: string, id: string, dados: DadosSemana): Promise<void> {
  const ig = dados.instagram;
  if (!ig) return;
  const ids = [...new Set([...ig.melhores, ...ig.lista.slice(-9).map((p) => p.media_id)])].slice(0, 12);
  try {
    const r = await callFunction<{ conta: { foto: string | null }; capas: { media_id: string; url: string }[] }>(
      "instagram-midias",
      `?cliente=${encodeURIComponent(cliente)}&ids=${ids.join(",")}`,
    );
    const baixar = async (url: string, path: string) => {
      const resp = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!resp.ok) throw new Error(`imagem ${resp.status}`);
      await uploadObject(path, Buffer.from(await resp.arrayBuffer()), resp.headers.get("content-type") ?? "image/jpeg");
      return path;
    };
    await Promise.all(
      r.capas.map(async (c) => {
        const post = ig.lista.find((p) => p.media_id === c.media_id);
        if (post) post.capa = await baixar(c.url, `relatorios/${id}/${c.media_id}.jpg`).catch(() => null);
      }),
    );
    if (r.conta.foto) dados.foto_perfil = await baixar(r.conta.foto, `relatorios/${id}/perfil.jpg`).catch(() => null);
  } catch (error) {
    // Sem as imagens o relatório continua (os cartões mostram o formato no lugar da capa).
    console.error("[relatorios] capas:", error);
  }
}

export async function coletar(cliente: string, inicio: string, id: string): Promise<DadosSemana> {
  const fim = somaDias(inicio, 6);
  const [ig, ld, ap] = await Promise.all([instagram(cliente, inicio, fim), leads(cliente, inicio), aprovadas(cliente, inicio)]);
  const dados: DadosSemana = { instagram: ig, leads: ld, aprovadas: ap, foto_perfil: null };
  await guardarImagens(cliente, id, dados);
  return dados;
}

// ---------- Leitura e gravação ----------

export async function carregar(id: string): Promise<RelatorioSemana | null> {
  const rows = await rest<RelatorioSemana[]>(`relatorios_semanais?id=eq.${id}&select=${COLS}`);
  return rows[0] ?? null;
}

export async function daSemana(cliente: string, inicio: string): Promise<RelatorioSemana | null> {
  const rows = await rest<RelatorioSemana[]>(`relatorios_semanais?cliente_slug=eq.${cliente}&semana_inicio=eq.${inicio}&select=${COLS}`);
  return rows[0] ?? null;
}

export async function doCliente(cliente: string, soPublicados = false): Promise<RelatorioSemana[]> {
  return rest<RelatorioSemana[]>(
    `relatorios_semanais?cliente_slug=eq.${cliente}${soPublicados ? "&status=eq.publicado" : ""}&select=${COLS}&order=semana_inicio.desc&limit=60`,
  );
}

export async function salvar(row: Partial<RelatorioSemana> & { cliente_slug: string; semana_inicio: string }, quem: string | null): Promise<RelatorioSemana> {
  const body = { ...row, semana_fim: somaDias(row.semana_inicio, 6), atualizado_por: quem, atualizado_em: new Date().toISOString() };
  const rows = await rest<RelatorioSemana[]>(`relatorios_semanais?on_conflict=cliente_slug,semana_inicio&select=${COLS}`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row.id ? body : { ...body, criado_por: quem }),
  });
  return rows[0];
}

export async function atualizar(id: string, campos: Partial<RelatorioSemana>, quem: string | null): Promise<RelatorioSemana> {
  const rows = await rest<RelatorioSemana[]>(`relatorios_semanais?id=eq.${id}&select=${COLS}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...campos, atualizado_por: quem, atualizado_em: new Date().toISOString() }),
  });
  if (!rows[0]) throw new Error("Relatório não encontrado.");
  return rows[0];
}

/** Link fixo do cliente (cria na primeira vez). */
export async function linkDoCliente(cliente: string): Promise<string> {
  const rows = await rest<{ token: string }[]>(`relatorios_links?cliente_slug=eq.${cliente}&select=token`);
  if (rows[0]) return rows[0].token;
  const token = randomBytes(15).toString("base64url");
  const novo = await rest<{ token: string }[]>("relatorios_links?on_conflict=cliente_slug&select=token", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ cliente_slug: cliente, token }),
  });
  return novo[0]?.token ?? (await rest<{ token: string }[]>(`relatorios_links?cliente_slug=eq.${cliente}&select=token`))[0].token;
}

export async function clienteDoToken(token: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{10,60}$/.test(token)) return null;
  const rows = await rest<{ cliente_slug: string }[]>(`relatorios_links?token=eq.${token}&select=cliente_slug`);
  return rows[0]?.cliente_slug ?? null;
}

/** URLs assinadas das imagens guardadas do relatório (capas e foto de perfil). */
export async function urlsDasImagens(dados: DadosSemana): Promise<Record<string, string>> {
  const paths = [...(dados.instagram?.lista ?? []).map((p) => p.capa), dados.foto_perfil].filter((p): p is string => Boolean(p));
  return signObjects(paths, 6 * 3600).catch(() => ({}));
}

export async function nomeDoCliente(cliente: string): Promise<string> {
  const rows = await rest<{ nome: string }[]>(`clientes?slug=eq.${cliente}&select=nome`).catch(() => []);
  return rows[0]?.nome ?? cliente;
}
