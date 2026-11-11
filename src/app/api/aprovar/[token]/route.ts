// Aprovação por link (lado do cliente, sem login): o token do link é a chave.
// GET: telas, legenda, status e comentários. POST: comentar, aprovar ou pedir ajustes.

import { NextResponse } from "next/server";
import { z } from "zod";
import { addAviso, addComentario, loadByToken, loadComentarios, publicOrigin, sendToDrive, setStatus, signedTelas } from "@/lib/server/aprovacoes";
import { rest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

async function clienteNome(slug: string | null): Promise<string | null> {
  if (!slug) return null;
  const rows = await rest<{ nome: string }[]>(`clientes?slug=eq.${slug}&select=nome`).catch(() => []);
  return rows[0]?.nome ?? null;
}

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const row = await loadByToken(token).catch(() => null);
  if (!row) return NextResponse.json({ error: "Link de aprovação não encontrado." }, { status: 404 });
  const [telas, comentarios, cliente] = await Promise.all([signedTelas(row), loadComentarios([row.id]), clienteNome(row.cliente_slug)]);
  return NextResponse.json({
    titulo: row.titulo,
    cliente,
    legenda: row.legenda,
    status: row.status,
    respondido_por: row.respondido_por,
    respondido_em: row.respondido_em,
    criado_em: row.criado_em,
    telas,
    comentarios: comentarios.map(({ tela, autor, texto, criado_em }) => ({ tela, autor, texto, criado_em })),
  });
}

const postSchema = z.object({
  acao: z.enum(["comentar", "aprovar", "ajustes"]),
  autor: z.string().trim().min(2).max(80),
  tela: z.number().int().min(0).max(30).nullish(),
  texto: z.string().trim().max(2000).default(""),
});

export async function POST(request: Request, { params }: Params) {
  const { token } = await params;
  const row = await loadByToken(token).catch(() => null);
  if (!row) return NextResponse.json({ error: "Link de aprovação não encontrado." }, { status: 404 });
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escreva seu nome (e o comentário)." }, { status: 400 });
  const { acao, autor, tela, texto } = parsed.data;
  if (tela != null && tela >= row.telas.length) return NextResponse.json({ error: "Tela inexistente." }, { status: 400 });
  if (acao === "comentar" && !texto) return NextResponse.json({ error: "Escreva o comentário." }, { status: 400 });
  if (acao === "ajustes" && !texto) return NextResponse.json({ error: "Diga o que precisa ajustar." }, { status: 400 });
  const existentes = await loadComentarios([row.id]);
  if (existentes.length >= 200) return NextResponse.json({ error: "Limite de comentários deste link atingido." }, { status: 429 });
  try {
    if (texto) await addComentario(row.id, { tela: tela ?? null, autor, texto });
    if (acao !== "comentar") {
      await setStatus(row.id, acao === "aprovar" ? "aprovado" : "ajustes", autor);
      const cliente = await clienteNome(row.cliente_slug);
      const link = row.peca_id ? `${publicOrigin(request)}/feed?peca=${row.peca_id}` : `${publicOrigin(request)}/aprovar/${row.token}`;
      await addAviso({
        para_email: row.criado_por_email,
        tipo: acao === "aprovar" ? "aprovacao_aprovada" : "aprovacao_ajustes",
        titulo: `${cliente ?? "Cliente"} ${acao === "aprovar" ? "aprovou" : "pediu ajustes em"} "${row.titulo}"`,
        texto: acao === "ajustes" ? `${autor}: ${texto}` : `Aprovado por ${autor}.`,
        link,
        cliente_slug: row.cliente_slug,
      }).catch((error) => console.error("[aprovar] aviso:", error));
      // Aprovado: sobe as telas para a pasta do cliente no Drive (em segundo plano; o erro fica na aprovação).
      if (acao === "aprovar") void sendToDrive(row).catch((error) => console.error("[aprovar] drive:", error));
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[aprovar] salvar:", error);
    return NextResponse.json({ error: "Não foi possível salvar agora. Tente de novo." }, { status: 502 });
  }
}
