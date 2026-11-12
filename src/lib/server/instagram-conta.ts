import "server-only";
// Dados da conta do Instagram que antes vinham do mLabs, pela função instagram-conta do Supabase
// (o token da Meta fica só lá): números da conta no período, público, comentários e nicho.
// Tudo opcional: se a Meta falhar, o relatório sai sem a parte que faltou.

import { comentariosCandidatos, contaIgDe, nichoDe, publicoDe } from "../relatorio/extras";
import type { ContaIg, Nicho, Publico } from "../relatorio/tipos";
import { callFunction, rest } from "./supabase";

const log = (parte: string) => (e: unknown) => {
  console.error(`[relatorios] ${parte}:`, e instanceof Error ? e.message : e);
  return null;
};

export async function contaNoPeriodo(cliente: string, since: string, until: string): Promise<ContaIg | null> {
  const r = await callFunction<{ numeros: Record<string, number> }>("instagram-conta", `?acao=conta&cliente=${cliente}&since=${since}&until=${until}`).catch(
    log("conta"),
  );
  return contaIgDe(r?.numeros);
}

export async function publicoDoCliente(cliente: string): Promise<Publico | null> {
  const r = await callFunction<Parameters<typeof publicoDe>[0]>("instagram-conta", `?acao=publico&cliente=${cliente}`).catch(log("publico"));
  return publicoDe(r);
}

export async function comentariosDosPosts(ids: string[]) {
  if (!ids.length) return [];
  const r = await callFunction<{ comentarios: { media_id: string; texto: string; curtidas: number }[] }>("instagram-conta", "?acao=comentarios", {
    ids: ids.slice(0, 30),
  }).catch(log("comentarios"));
  return comentariosCandidatos(r?.comentarios ?? []);
}

/** Perfis do nicho cadastrados para o cliente (clientes.nicho_perfis), comparados pela mesma régua. */
export async function nichoDoCliente(cliente: string, usuario: string | undefined): Promise<Nicho | null> {
  if (!usuario) return null;
  const rows = await rest<{ nicho_perfis: string[] | null }[]>(`clientes?slug=eq.${cliente}&select=nicho_perfis&limit=1`).catch(() => []);
  const perfis = (rows[0]?.nicho_perfis ?? []).filter((p) => p.toLowerCase() !== usuario.toLowerCase());
  if (perfis.length < 3) return null;
  const r = await callFunction<{ perfis: Parameters<typeof nichoDe>[0] }>("instagram-conta", `?acao=nicho&cliente=${cliente}`, {
    perfis: [usuario, ...perfis].slice(0, 40),
  }).catch(log("nicho"));
  return r ? nichoDe(r.perfis, usuario) : null;
}
