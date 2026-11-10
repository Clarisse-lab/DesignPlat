// Imagens já geradas com IA (design_imagens), da mais nova para a mais antiga.
// Cada uma vem com um link temporário da miniatura (ou da imagem, se ainda não tem miniatura).

import { NextResponse } from "next/server";
import { isResponse, requireMember } from "@/lib/server/auth";
import { rest, signObjects } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Row {
  id: string;
  cliente_slug: string | null;
  prompt: string;
  estilo: string | null;
  zona: string | null;
  proporcao: string | null;
  editada: boolean;
  com_rosto: boolean;
  caminho: string;
  miniatura: string | null;
  criado_por: string | null;
  criado_em: string;
}

/** GET ?cliente=slug&antes=ISO&limite=N (até 60). Sem cliente: todas. */
export async function GET(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const params = new URL(request.url).searchParams;
  const limite = Math.min(60, Math.max(1, Number(params.get("limite")) || 30));
  const filtros = [
    "select=id,cliente_slug,prompt,estilo,zona,proporcao,editada,com_rosto,caminho,miniatura,criado_por,criado_em",
    "order=criado_em.desc",
    `limit=${limite}`,
  ];
  const cliente = params.get("cliente");
  if (cliente && /^[a-z0-9-]{2,60}$/.test(cliente)) filtros.push(`cliente_slug=eq.${cliente}`);
  const antes = params.get("antes");
  if (antes && !Number.isNaN(Date.parse(antes))) filtros.push(`criado_em=lt.${encodeURIComponent(new Date(antes).toISOString())}`);
  try {
    const rows = await rest<Row[]>(`design_imagens?${filtros.join("&")}`);
    const links = await signObjects(rows.map((r) => r.miniatura ?? r.caminho));
    return NextResponse.json({
      imagens: rows.map(({ caminho, miniatura, ...r }) => ({ ...r, miniatura: links[miniatura ?? caminho] ?? null, tem_miniatura: Boolean(miniatura) })),
    });
  } catch (error) {
    console.error("[estudio/imagens] lista:", error);
    return NextResponse.json({ error: "Não foi possível listar as imagens geradas." }, { status: 502 });
  }
}
