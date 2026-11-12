import "server-only";
// Leitura das tarefas do cliente no ClickUp (só leitura), para o relatório mostrar o trabalho da Mantora.
// Pastas e listas de cada cliente ficam em clientes.clickup_pastas / clickup_listas (Supabase).
// Precisa de CLICKUP_TOKEN (token pessoal, começa com pk_) no ambiente; sem ele, o relatório sai sem essa parte.

import { somaDias } from "../relatorio/calc";
import { separarTarefas, type TarefaBruta } from "../relatorio/trabalho";
import type { TipoPeriodo, TrabalhoPeriodo } from "../relatorio/tipos";
import { rest } from "./supabase";

const API = "https://api.clickup.com/api/v2";
const WORKSPACE = (process.env.CLICKUP_WORKSPACE ?? "90131874842").trim();
const token = () => (process.env.CLICKUP_TOKEN ?? "").trim();
export const clickupLigado = () => Boolean(token());

interface TarefaApi {
  name: string;
  status?: { status?: string; type?: string };
  due_date?: string | null;
  date_updated?: string | null;
  list?: { name?: string };
}

async function pagina(filtro: Record<string, string[]>, desde: number, page: number): Promise<{ tasks: TarefaApi[]; last_page?: boolean }> {
  const url = new URL(`${API}/team/${WORKSPACE}/task`);
  for (const [k, vs] of Object.entries(filtro)) vs.forEach((v) => url.searchParams.append(`${k}[]`, v));
  url.searchParams.set("include_closed", "true");
  url.searchParams.set("subtasks", "true");
  url.searchParams.set("date_updated_gt", String(desde));
  url.searchParams.set("page", String(page));
  const chamar = (auth: string) => fetch(url, { headers: { Authorization: auth }, signal: AbortSignal.timeout(20_000) });
  let r = await chamar(token());
  if (r.status === 401) r = await chamar(`Bearer ${token()}`); // tokens novos do ClickUp podem exigir "Bearer"
  if (!r.ok) throw new Error(`ClickUp ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function todas(filtro: Record<string, string[]>, desde: number): Promise<TarefaApi[]> {
  const lista: TarefaApi[] = [];
  for (let page = 0; page < 5; page++) {
    const j = await pagina(filtro, desde, page);
    lista.push(...(j.tasks ?? []));
    if (j.last_page !== false || (j.tasks ?? []).length < 100) break;
  }
  return lista;
}

/** Tarefas do cliente (pastas dele em Clientes Ativos + listas dele em Design e Edição) separadas para o período. */
export async function trabalhoDoCliente(cliente: string, tipo: TipoPeriodo, inicio: string, fim: string): Promise<TrabalhoPeriodo | null> {
  if (!clickupLigado()) return null;
  const rows = await rest<{ clickup_pastas: string[] | null; clickup_listas: string[] | null }[]>(
    `clientes?slug=eq.${cliente}&select=clickup_pastas,clickup_listas&limit=1`,
  ).catch(() => []);
  const pastas = rows[0]?.clickup_pastas ?? [];
  const listas = rows[0]?.clickup_listas ?? [];
  if (!pastas.length && !listas.length) return null;
  try {
    // Tarefas mexidas desde 45 dias antes do início (as em andamento e as próximas também costumam ter sido mexidas).
    const desde = new Date(`${somaDias(inicio, -45)}T03:00:00Z`).getTime();
    const partes = await Promise.all([
      pastas.length ? todas({ project_ids: pastas }, desde) : [],
      listas.length ? todas({ list_ids: listas }, desde) : [],
    ]);
    const brutas: TarefaBruta[] = partes.flat().map((t) => ({
      nome: t.name ?? "",
      lista: t.list?.name ?? "",
      status: t.status?.status ?? "",
      fechada: t.status?.type === "closed" || t.status?.type === "done",
      prazo: t.due_date ? Number(t.due_date) : null,
      atualizada: Number(t.date_updated ?? 0),
    }));
    return { ...separarTarefas(brutas, tipo, inicio, fim), em: new Date().toISOString() };
  } catch (error) {
    // Sem o ClickUp o relatório continua; a equipe vê o aviso na aba Relatórios.
    console.error("[relatorios] clickup:", error);
    return null;
  }
}
