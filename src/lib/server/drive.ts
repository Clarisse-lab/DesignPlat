import "server-only";
// Google Drive da agência: a plataforma entra como a conta que é dona das pastas dos clientes
// (OAuth uma vez em /drive; o refresh token fica em design_integracoes, só service role).
// Conta de serviço não serve aqui: as pastas estão num Drive de conta Gmail e conta de serviço
// não tem espaço para criar arquivos nele.
//
// Variáveis no Railway: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (ID do cliente OAuth "Aplicativo da Web",
// com o redirecionamento https://<site>/api/drive/callback).

import { randomBytes } from "node:crypto";
import { rest } from "./supabase";

const CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? "").trim();
const CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET ?? "").trim();
const SCOPES = ["https://www.googleapis.com/auth/drive", "openid", "email"];
const API = "https://www.googleapis.com/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";
const KEY = "google_drive";

export const driveConfigured = () => Boolean(CLIENT_ID && CLIENT_SECRET);

interface Saved {
  refresh_token: string;
  email: string | null;
  conectado_em: string;
  conectado_por: string | null;
}

async function getIntegracao<T>(chave: string): Promise<T | null> {
  const rows = await rest<{ valor: T }[]>(`design_integracoes?chave=eq.${encodeURIComponent(chave)}&select=valor`);
  return rows[0]?.valor ?? null;
}
async function setIntegracao(chave: string, valor: unknown): Promise<void> {
  await rest("design_integracoes", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ chave, valor, atualizado_em: new Date().toISOString() }),
  });
}
async function delIntegracao(chave: string): Promise<void> {
  await rest(`design_integracoes?chave=eq.${encodeURIComponent(chave)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

export async function driveStatus(): Promise<{ email: string | null; conectado_em: string } | null> {
  const saved = await getIntegracao<Saved>(KEY);
  return saved ? { email: saved.email, conectado_em: saved.conectado_em } : null;
}

/** Link do Google para conectar (o state de uso único vale 15 minutos). */
export async function authUrl(redirectUri: string, quem: string | null): Promise<string> {
  const state = randomBytes(16).toString("base64url");
  await setIntegracao(`oauth_state:${state}`, { quem, exp: Date.now() + 15 * 60_000 });
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

/** Volta do Google: troca o código pelo refresh token e guarda. */
export async function finishAuth(code: string, state: string, redirectUri: string): Promise<string | null> {
  const st = await getIntegracao<{ quem: string | null; exp: number }>(`oauth_state:${state}`);
  await delIntegracao(`oauth_state:${state}`).catch(() => undefined);
  if (!st || st.exp < Date.now()) throw new Error("O pedido de conexão expirou. Tente de novo.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const data = (await response.json().catch(() => ({}))) as { refresh_token?: string; id_token?: string; error_description?: string };
  if (!response.ok || !data.refresh_token) throw new Error(data.error_description ?? "O Google não devolveu a permissão de acesso contínuo.");
  let email: string | null = null;
  try {
    email = JSON.parse(Buffer.from((data.id_token ?? "").split(".")[1] ?? "", "base64url").toString()).email ?? null;
  } catch {
    /* sem e-mail: segue */
  }
  await setIntegracao(KEY, { refresh_token: data.refresh_token, email, conectado_em: new Date().toISOString(), conectado_por: st.quem } satisfies Saved);
  cached = null;
  return email;
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const saved = await getIntegracao<Saved>(KEY);
  if (!saved) throw new Error("Google Drive não conectado (página Drive da plataforma).");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: saved.refresh_token, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, grant_type: "refresh_token" }),
  });
  const data = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error === "invalid_grant" ? "A conexão com o Google Drive expirou. Conecte de novo na página Drive." : "Falha ao entrar no Google Drive.");
  }
  cached = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function drive<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const response = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`Drive ${response.status}: ${(await response.text()).slice(0, 200)}`);
  return (response.status === 204 ? null : await response.json()) as T;
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export async function getFolder(id: string): Promise<{ id: string; name: string; webViewLink: string }> {
  return drive(`/files/${encodeURIComponent(id)}?fields=id,name,mimeType,webViewLink&supportsAllDrives=true`);
}

async function children(parentId: string): Promise<{ id: string; name: string }[]> {
  const query = `'${q(parentId)}' in parents and mimeType='${FOLDER}' and trashed=false`;
  const data = await drive<{ files: { id: string; name: string }[] }>(
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`,
  );
  return data.files ?? [];
}

async function createFolder(parentId: string, name: string): Promise<{ id: string; name: string }> {
  return drive(`/files?supportsAllDrives=true&fields=id,name`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER, parents: [parentId] }),
  });
}

/** Acha a subpasta pelo critério (ex.: começa com "11") ou cria com o nome padrão. */
async function ensureFolder(parentId: string, match: (name: string) => boolean, name: string): Promise<string> {
  const found = (await children(parentId)).find((f) => match(f.name.trim()));
  return found ? found.id : (await createFolder(parentId, name)).id;
}

async function uploadFile(parentId: string, name: string, mimeType: string, bytes: Buffer): Promise<void> {
  const token = await accessToken();
  // Upload em duas etapas (resumable): serve para PNG e para o MP4, de qualquer tamanho.
  const start = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mimeType },
    body: JSON.stringify({ name, parents: [parentId] }),
  });
  const location = start.headers.get("location");
  if (!start.ok || !location) throw new Error(`Drive ${start.status} ao iniciar o envio de ${name}`);
  const put = await fetch(location, { method: "PUT", headers: { "Content-Type": mimeType }, body: new Uint8Array(bytes) });
  if (!put.ok) throw new Error(`Drive ${put.status} ao enviar ${name}`);
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const safeName = (s: string) => s.replace(/[\\/:*?"<>|\n\r]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 90);

/**
 * Sobe uma peça aprovada para a pasta do cliente, no padrão da agência:
 * <cliente>/05 - Designer/<ano>/<MM_Mês>/<dd-mm - título>/ (telas + legenda.txt).
 */
export async function uploadPost(input: {
  pastaCliente: string;
  titulo: string;
  quando: Date;
  arquivos: { name: string; mimeType: string; bytes: Buffer }[];
}): Promise<string> {
  // O mês/ano seguem o horário de Brasília.
  const br = new Date(input.quando.getTime() - 3 * 3600_000);
  const ano = String(br.getUTCFullYear());
  const mm = String(br.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(br.getUTCDate()).padStart(2, "0");
  const designer = await ensureFolder(input.pastaCliente, (n) => /designer/i.test(n), "05 - Designer");
  const year = await ensureFolder(designer, (n) => n === ano, ano);
  const month = await ensureFolder(year, (n) => n.startsWith(`${mm}_`) || n.startsWith(`${mm} `) || n === mm, `${mm}_${MESES[br.getUTCMonth()]}`);
  const base = safeName(`${dd}-${mm} - ${input.titulo}`) || `${dd}-${mm} - Post`;
  const existing = new Set((await children(month)).map((f) => f.name));
  let name = base;
  for (let k = 2; existing.has(name); k++) name = `${base} (${k})`;
  const folder = await createFolder(month, name);
  for (const f of input.arquivos) await uploadFile(folder.id, f.name, f.mimeType, f.bytes);
  return `https://drive.google.com/drive/folders/${folder.id}`;
}
