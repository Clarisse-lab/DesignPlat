import "server-only";
// Estilos de referência (design_estilos). Linhas com "dados" inválidos ficam de fora (e vão para o log).

import { estiloDadosSchema, type Estilo } from "../estilos";
import { rest } from "./supabase";

interface Row {
  id: string;
  nome: string;
  descricao: string | null;
  cliente_slug: string | null;
  padrao: boolean;
  dados: unknown;
}

const SELECT = "select=id,nome,descricao,cliente_slug,padrao,dados";

function validate(rows: Row[]): Estilo[] {
  const out: Estilo[] = [];
  for (const row of rows) {
    const dados = estiloDadosSchema.safeParse(row.dados);
    if (dados.success) out.push({ ...row, dados: dados.data });
    else console.error(`[estilos] estilo ${row.id} com dados inválidos:`, dados.error.issues[0]);
  }
  return out;
}

/** Os do cliente (o padrão primeiro) e os da agência. Sem cliente: só os da agência. */
export async function loadEstilos(cliente: string | null): Promise<Estilo[]> {
  const filtro = cliente ? `or=(cliente_slug.eq.${cliente},cliente_slug.is.null)` : "cliente_slug=is.null";
  return validate(await rest<Row[]>(`design_estilos?${SELECT}&${filtro}&order=padrao.desc,nome.asc`));
}

export async function loadEstilo(id: string): Promise<Estilo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return validate(await rest<Row[]>(`design_estilos?${SELECT}&id=eq.${id}`))[0] ?? null;
}

export interface EstiloInput {
  nome: string;
  descricao: string | null;
  cliente_slug: string | null;
  padrao: boolean;
  dados: Estilo["dados"];
}

/**
 * Cria (sem id) ou atualiza um estilo. Padrão é um por cliente: marcar este desmarca os outros
 * do mesmo cliente antes (o banco não aceita dois).
 */
export async function saveEstilo(input: EstiloInput, id: string | null, autor: string | null): Promise<Estilo> {
  if (input.padrao && input.cliente_slug) {
    const others = id ? `&id=neq.${id}` : "";
    await rest(`design_estilos?cliente_slug=eq.${input.cliente_slug}&padrao=is.true${others}`, {
      method: "PATCH",
      body: JSON.stringify({ padrao: false }),
    });
  }
  const linha = { ...input, padrao: input.padrao && Boolean(input.cliente_slug), atualizado_em: new Date().toISOString() };
  const rows = id
    ? await rest<Row[]>(`design_estilos?id=eq.${id}&${SELECT}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(linha) })
    : await rest<Row[]>(`design_estilos?${SELECT}`, { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...linha, criado_por: autor }) });
  const saved = validate(rows)[0];
  if (!saved) throw new Error("Estilo não encontrado (pode ter sido apagado).");
  return saved;
}
