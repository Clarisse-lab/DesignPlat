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
