// LinkedIn do cliente na aba Relatórios.
// GET  ?cliente=slug → { perfil, admins, paginas }: conexão do perfil do cliente, admins de páginas e todas as páginas conectadas (sem token)
// POST { acao: "link", tipo: "perfil" | "paginas", cliente? } → { url, valido_ate }: link de conexão para mandar à pessoa
// POST { acao: "coletar", dias? } → busca os números agora (depois de conectar ou de ligar uma página)
// PUT  { cliente, paginas: [org_urn] } → liga ao cliente exatamente estas páginas

import { NextResponse } from "next/server";
import { z } from "zod";
import { isResponse, requireMember } from "@/lib/server/auth";
import { coletarAgora, estadoLinkedin, linkDeConexao, salvarPaginas } from "@/lib/server/linkedin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9-]{2,60}$/;
const erro = (e: unknown) => (e instanceof Error ? e.message : "Falha no LinkedIn.");

export async function GET(request: Request) {
  const member = await requireMember(request);
  if (isResponse(member)) return member;
  const cliente = new URL(request.url).searchParams.get("cliente") ?? "";
  if (!SLUG.test(cliente)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  try {
    return NextResponse.json(await estadoLinkedin(cliente));
  } catch (e) {
    return NextResponse.json({ error: erro(e) }, { status: 500 });
  }
}

const postSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("link"), tipo: z.enum(["perfil", "paginas"]), cliente: z.string().regex(SLUG).nullable().optional() }),
  z.object({ acao: z.literal("coletar"), dias: z.number().int().min(3).max(365).optional() }),
]);

export async function POST(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const body = parsed.data;
  try {
    if (body.acao === "link") {
      if (body.tipo === "perfil" && !body.cliente) return NextResponse.json({ error: "Escolha o cliente." }, { status: 400 });
      return NextResponse.json(await linkDeConexao(body.tipo, body.tipo === "perfil" ? body.cliente! : null, member.nome || member.email));
    }
    return NextResponse.json(await coletarAgora(body.dias ?? 120));
  } catch (e) {
    console.error("[relatorios/linkedin]", e);
    return NextResponse.json({ error: erro(e) }, { status: 502 });
  }
}

const putSchema = z.object({
  cliente: z.string().regex(SLUG),
  paginas: z.array(z.string().regex(/^urn:li:organization:\d{1,20}$/)).max(10),
});

export async function PUT(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = putSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Páginas inválidas." }, { status: 400 });
  try {
    await salvarPaginas(parsed.data.cliente, parsed.data.paginas);
    return NextResponse.json(await estadoLinkedin(parsed.data.cliente));
  } catch (e) {
    console.error("[relatorios/linkedin]", e);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
