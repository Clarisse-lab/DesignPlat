import "server-only";
// LinkedIn do cliente: só lê as tabelas que o coletor diário do Supabase preenche (linkedin-coletor).
// Quem fala com o LinkedIn são as funções linkedin-auth e linkedin-coletor; o token nunca sai do Supabase.

import { periodoAnterior, somaDias } from "../relatorio/calc";
import { linkedinDoPeriodo, type DiaLinkedin, type FonteLinkedin, type PostLinkedin } from "../relatorio/linkedin";
import type { LinkedinPeriodo, TipoPeriodo } from "../relatorio/tipos";
import { callFunction, rest } from "./supabase";

export interface PaginaLinkedin {
  org_urn: string;
  nome: string | null;
  vanity: string | null;
  cliente_slug: string | null;
  monitorar: boolean;
}

/** Conexão sem o token: o Design Mantora nunca lê access_token. */
export interface ConexaoLinkedin {
  id: string;
  membro_urn: string;
  tipo: "perfil" | "paginas";
  nome: string | null;
  cliente_slug: string | null;
  expira_em: string;
  ultimo_erro: string | null;
  conectado_em: string;
}

const COLS_CONEXAO = "id,membro_urn,tipo,nome,cliente_slug,expira_em,ultimo_erro,conectado_em";
const inList = (xs: string[]) => `(${xs.map((x) => `"${x}"`).join(",")})`;

/** Páginas ligadas ao cliente e o perfil dele (quando é um perfil pessoal). */
export async function fontesDoCliente(cliente: string): Promise<FonteLinkedin[]> {
  const [paginas, perfis] = await Promise.all([
    rest<PaginaLinkedin[]>(`linkedin_paginas?cliente_slug=eq.${cliente}&monitorar=is.true&select=org_urn,nome,vanity,cliente_slug,monitorar`),
    rest<ConexaoLinkedin[]>(`linkedin_conexoes?cliente_slug=eq.${cliente}&tipo=eq.perfil&ativo=is.true&select=${COLS_CONEXAO}`),
  ]);
  return [
    ...paginas.map((p) => ({ urn: p.org_urn, nome: p.nome ?? p.vanity ?? "Página", tipo: "pagina" as const })),
    ...perfis.map((c) => ({ urn: c.membro_urn, nome: c.nome ?? "Perfil", tipo: "perfil" as const })),
  ];
}

export async function linkedinDoCliente(cliente: string, tipo: TipoPeriodo, inicio: string, fim: string): Promise<LinkedinPeriodo | null> {
  const fontes = await fontesDoCliente(cliente);
  if (!fontes.length) return null;
  const anterior = periodoAnterior(tipo, inicio);
  const leituraAte = somaDias(fim, 1);
  const urns = inList(fontes.map((f) => f.urn));
  const [dias, posts] = await Promise.all([
    rest<DiaLinkedin[]>(
      `linkedin_dias?fonte_urn=in.${urns}&data=gte.${somaDias(anterior.inicio, -40)}&data=lte.${leituraAte}` +
        "&select=fonte_urn,data,impressoes,reacoes,comentarios,compartilhamentos,cliques,novos_seguidores,seguidores,visualizacoes_pagina&limit=5000",
    ),
    rest<PostLinkedin[]>(
      `linkedin_posts?org_urn=in.${urns}&publicado_em=gte.${inicio}T00:00:00-03:00&publicado_em=lte.${fim}T23:59:59-03:00` +
        "&select=post_urn,publicado_em,texto,impressoes,reacoes,comentarios,compartilhamentos,cliques&limit=200",
    ),
  ]);
  return linkedinDoPeriodo({ fontes, dias, posts, periodo: { inicio, fim }, anterior, leituraAte });
}

// ---------- Configuração (aba Relatórios) ----------

export async function estadoLinkedin(cliente: string) {
  const [paginas, conexoes] = await Promise.all([
    rest<PaginaLinkedin[]>("linkedin_paginas?select=org_urn,nome,vanity,cliente_slug,monitorar&order=nome.asc"),
    rest<ConexaoLinkedin[]>(`linkedin_conexoes?ativo=is.true&select=${COLS_CONEXAO}&order=conectado_em.desc`),
  ]);
  return {
    perfil: conexoes.find((c) => c.tipo === "perfil" && c.cliente_slug === cliente) ?? null,
    admins: conexoes.filter((c) => c.tipo === "paginas"),
    paginas,
  };
}

/** Liga ao cliente exatamente as páginas escolhidas (as que eram dele e saíram da lista ficam sem cliente). */
export async function salvarPaginas(cliente: string, orgs: string[]): Promise<void> {
  const validas = orgs.filter((o) => /^urn:li:organization:\d{1,20}$/.test(o));
  await rest(`linkedin_paginas?cliente_slug=eq.${cliente}${validas.length ? `&org_urn=not.in.${inList(validas)}` : ""}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ cliente_slug: null }),
  });
  if (validas.length) {
    await rest(`linkedin_paginas?org_urn=in.${inList(validas)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ cliente_slug: cliente, monitorar: true }),
    });
  }
}

/** Link de conexão (vale 7 dias, uma vez): perfil do cliente ou admin das páginas. */
export async function linkDeConexao(tipo: "perfil" | "paginas", cliente: string | null, por: string): Promise<{ url: string; valido_ate: string }> {
  return callFunction("linkedin-auth", "?acao=link", { tipo, cliente, por });
}

/** Busca os números agora (ex.: logo depois de conectar ou de ligar uma página), com a janela pedida. */
export async function coletarAgora(dias: number, fonte?: string): Promise<{ status: string; erros: string[] }> {
  const q = `?dias=${Math.min(365, Math.max(3, Math.round(dias)))}${fonte ? `&fonte=${encodeURIComponent(fonte)}` : ""}`;
  return callFunction("linkedin-coletor", q);
}
