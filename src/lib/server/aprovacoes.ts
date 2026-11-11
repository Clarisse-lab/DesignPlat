import "server-only";
// Aprovação por link: a peça é "fotografada" (PNG das telas paradas, MP4 das animadas) no momento
// em que o link é criado, e o cliente vê, comenta por tela e aprova sem login (só com o token).

import { randomBytes } from "node:crypto";
import { buildFeedPages } from "../feed/pages";
import type { FeedRenderRequest } from "../feed/schema";
import { renderPagesToPng } from "../render/html-to-image";
import { renderHtmlToMp4 } from "../render/html-to-video";
import { hasMotion, motionDuration, type FreeSlide } from "../templates/free";
import { driveConfigured, uploadPost } from "./drive";
import { downloadObject, rest, signObjects, uploadObject } from "./supabase";

export type AprovacaoStatus = "pendente" | "aprovado" | "ajustes";

export interface AprovacaoTela {
  path: string;
  tipo: "png" | "mp4";
}

export interface AprovacaoRow {
  id: string;
  token: string;
  peca_id: string | null;
  cliente_slug: string | null;
  titulo: string;
  legenda: string | null;
  telas: AprovacaoTela[];
  status: AprovacaoStatus;
  respondido_por: string | null;
  respondido_em: string | null;
  criado_por: string | null;
  criado_por_email: string | null;
  criado_em: string;
  drive_url: string | null;
  drive_erro: string | null;
}

export interface Comentario {
  id: string;
  tela: number | null;
  autor: string;
  texto: string;
  criado_em: string;
}

const COLS = "id,token,peca_id,cliente_slug,titulo,legenda,telas,status,respondido_por,respondido_em,criado_por,criado_por_email,criado_em,drive_url,drive_erro";
const pad = (i: number) => String(i + 1).padStart(2, "0");
const animated = (slide: { layout: string; free?: unknown }) => slide.layout === "livre" && hasMotion(slide.free as FreeSlide | null);

/** Renderiza as telas, guarda no bucket e cria o link. */
export async function createAprovacao(input: {
  render: FeedRenderRequest;
  titulo: string;
  legenda: string | null;
  peca_id: string | null;
  cliente_slug: string | null;
  criado_por: string | null;
  criado_por_email: string | null;
}): Promise<AprovacaoRow> {
  const id = crypto.randomUUID();
  const token = randomBytes(18).toString("base64url");
  const { slides } = input.render;
  const pages = buildFeedPages(input.render);
  const stillIdx = slides.map((s, i) => (animated(s) ? -1 : i)).filter((i) => i >= 0);
  const pngs = await renderPagesToPng(stillIdx.map((i) => pages[i]));
  const telas: AprovacaoTela[] = [];
  const animatedPages = stillIdx.length === slides.length ? null : buildFeedPages(input.render, { animate: true });
  for (let i = 0; i < slides.length; i++) {
    const k = stillIdx.indexOf(i);
    if (k >= 0) {
      const path = `aprovacoes/${id}/tela-${pad(i)}.png`;
      await uploadObject(path, pngs[k], "image/png");
      telas.push({ path, tipo: "png" });
    } else {
      const mp4 = await renderHtmlToMp4({ ...animatedPages![i], seconds: motionDuration(slides[i].free as FreeSlide) });
      const path = `aprovacoes/${id}/tela-${pad(i)}.mp4`;
      await uploadObject(path, mp4, "video/mp4");
      telas.push({ path, tipo: "mp4" });
    }
  }
  const rows = await rest<AprovacaoRow[]>(`design_aprovacoes?select=${COLS}`, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      id,
      token,
      peca_id: input.peca_id,
      cliente_slug: input.cliente_slug,
      titulo: input.titulo.slice(0, 160),
      legenda: input.legenda,
      telas,
      criado_por: input.criado_por,
      criado_por_email: input.criado_por_email,
    }),
  });
  return rows[0];
}

export async function loadByToken(token: string): Promise<AprovacaoRow | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const rows = await rest<AprovacaoRow[]>(`design_aprovacoes?token=eq.${token}&select=${COLS}`);
  return rows[0] ?? null;
}

export async function loadComentarios(aprovacaoIds: string[]): Promise<(Comentario & { aprovacao_id: string })[]> {
  if (!aprovacaoIds.length) return [];
  return rest(`design_aprovacao_comentarios?aprovacao_id=in.(${aprovacaoIds.join(",")})&select=id,aprovacao_id,tela,autor,texto,criado_em&order=criado_em.asc`);
}

/** Links das telas (válidos por 12 h) para mostrar ao cliente ou à equipe. */
export async function signedTelas(row: AprovacaoRow): Promise<{ url: string; tipo: "png" | "mp4" }[]> {
  const urls = await signObjects(row.telas.map((t) => t.path), 12 * 3600);
  return row.telas.map((t) => ({ url: urls[t.path] ?? "", tipo: t.tipo }));
}

export async function addComentario(aprovacaoId: string, c: { tela: number | null; autor: string; texto: string }): Promise<void> {
  await rest("design_aprovacao_comentarios", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ aprovacao_id: aprovacaoId, ...c }),
  });
}

export async function setStatus(aprovacaoId: string, status: AprovacaoStatus, autor: string): Promise<void> {
  await rest(`design_aprovacoes?id=eq.${aprovacaoId}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status, respondido_por: autor, respondido_em: new Date().toISOString() }),
  });
}

export async function listByPeca(pecaId: string): Promise<AprovacaoRow[]> {
  return rest(`design_aprovacoes?peca_id=eq.${pecaId}&select=${COLS}&order=criado_em.desc&limit=10`);
}

/** Endereço público do site (atrás do proxy do Railway, o request.url é interno). */
export function publicOrigin(request: Request): string {
  const env = (process.env.DESIGN_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  if (env) return env;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/** Aviso para a equipe (o Escritório mostra no sino). Sem e-mail de quem criou: vai para todos. */
export async function addAviso(a: { para_email: string | null; tipo: string; titulo: string; texto?: string | null; link?: string | null; cliente_slug?: string | null }): Promise<void> {
  await rest("avisos", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ origem: "design", texto: null, link: null, cliente_slug: null, ...a }),
  });
}

/**
 * Peça aprovada → pasta do cliente no Drive (telas + legenda.txt). Guarda o link ou o erro na
 * aprovação para a equipe ver (e poder tentar de novo).
 */
export async function sendToDrive(row: AprovacaoRow): Promise<string> {
  try {
    if (!driveConfigured()) throw new Error("Google Drive não configurado (GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no Railway).");
    if (!row.cliente_slug) throw new Error("A peça não tem cliente: não sei em que pasta salvar.");
    const pastas = await rest<{ pasta_id: string }[]>(`design_drive_pastas?cliente_slug=eq.${row.cliente_slug}&select=pasta_id`);
    if (!pastas[0]) throw new Error("Este cliente ainda não tem pasta do Drive definida (página Drive da plataforma).");
    const arquivos = [];
    for (const [i, t] of row.telas.entries()) {
      const { bytes } = await downloadObject(t.path);
      arquivos.push({ name: `tela-${pad(i)}.${t.tipo}`, mimeType: t.tipo === "mp4" ? "video/mp4" : "image/png", bytes });
    }
    if (row.legenda?.trim()) arquivos.push({ name: "legenda.txt", mimeType: "text/plain", bytes: Buffer.from(row.legenda, "utf8") });
    const url = await uploadPost({ pastaCliente: pastas[0].pasta_id, titulo: row.titulo, quando: new Date(), arquivos });
    await rest(`design_aprovacoes?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ drive_url: url, drive_erro: null, drive_em: new Date().toISOString() }),
    });
    return url;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await rest(`design_aprovacoes?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ drive_erro: msg.slice(0, 300) }),
    }).catch(() => undefined);
    throw error;
  }
}

export async function loadById(id: string): Promise<AprovacaoRow | null> {
  const rows = await rest<AprovacaoRow[]>(`design_aprovacoes?id=eq.${id}&select=${COLS}`);
  return rows[0] ?? null;
}
