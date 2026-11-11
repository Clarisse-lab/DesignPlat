// Aprovação por link (lado da equipe): POST cria o link com as telas renderizadas; GET ?peca=id
// lista os links da peça com status e comentários do cliente.

import { NextResponse } from "next/server";
import { z } from "zod";
import { feedRenderRequestSchema } from "@/lib/feed/schema";
import { createAprovacao, listByPeca, loadComentarios } from "@/lib/server/aprovacoes";
import { isResponse, requireMember } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const createSchema = z.object({
  render: feedRenderRequestSchema,
  titulo: z.string().trim().min(1).max(160),
  legenda: z.string().max(5000).nullish(),
  peca_id: z.string().uuid().nullish(),
  cliente_slug: z.string().regex(/^[a-z0-9-]{2,60}$/).nullish(),
});

export async function POST(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos para o link de aprovação." }, { status: 400 });
  const { render, titulo, legenda, peca_id, cliente_slug } = parsed.data;
  try {
    const row = await createAprovacao({
      render,
      titulo,
      legenda: legenda?.trim() || null,
      peca_id: peca_id ?? null,
      cliente_slug: cliente_slug ?? null,
      criado_por: member.nome || member.email || null,
    });
    return NextResponse.json({ aprovacao: row });
  } catch (error) {
    console.error("[estudio/aprovacoes] criar:", error);
    return NextResponse.json({ error: `Não foi possível criar o link: ${String(error).slice(0, 160)}` }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const peca = new URL(request.url).searchParams.get("peca") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(peca)) return NextResponse.json({ aprovacoes: [] });
  try {
    const rows = await listByPeca(peca);
    const comentarios = await loadComentarios(rows.map((r) => r.id));
    return NextResponse.json({
      aprovacoes: rows.map((r) => ({ ...r, comentarios: comentarios.filter((c) => c.aprovacao_id === r.id) })),
    });
  } catch (error) {
    console.error("[estudio/aprovacoes] listar:", error);
    return NextResponse.json({ error: "Não foi possível carregar as aprovações." }, { status: 502 });
  }
}
