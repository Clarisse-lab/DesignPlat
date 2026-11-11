// Estilos de referência (design_estilos): os do cliente pedido e os da agência (sem cliente).
// O padrão do cliente vem primeiro. POST cria ou atualiza (com id) um estilo salvo pelo editor.

import { NextResponse } from "next/server";
import { z } from "zod";
import { estiloDadosSchema } from "@/lib/estilos";
import { isResponse, requireMember } from "@/lib/server/auth";
import { loadEstilos, saveEstilo } from "@/lib/server/estilos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?cliente=slug */
export async function GET(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const cliente = new URL(request.url).searchParams.get("cliente");
  const slug = cliente && /^[a-z0-9-]{2,60}$/.test(cliente) ? cliente : null;
  try {
    return NextResponse.json({ estilos: await loadEstilos(slug) });
  } catch (error) {
    console.error("[estudio/estilos]", error);
    return NextResponse.json({ error: "Não foi possível carregar os estilos." }, { status: 502 });
  }
}

const saveSchema = z.object({
  id: z.string().uuid().nullish(),
  nome: z.string().trim().min(2).max(80),
  descricao: z.string().trim().max(500).nullish(),
  cliente_slug: z.string().regex(/^[a-z0-9-]{2,60}$/).nullish(),
  padrao: z.boolean().default(false),
  dados: estiloDadosSchema,
});

/** POST: salva um estilo (com id, substitui o existente). */
export async function POST(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: `Estilo inválido: ${issue?.message ?? "dados incompletos"}` }, { status: 400 });
  }
  const { id, nome, descricao, cliente_slug, padrao, dados } = parsed.data;
  if (JSON.stringify(dados).length > 400_000) return NextResponse.json({ error: "Estilo grande demais para salvar." }, { status: 413 });
  try {
    const estilo = await saveEstilo({ nome, descricao: descricao || null, cliente_slug: cliente_slug ?? null, padrao, dados }, id ?? null, member.nome || member.email || null);
    return NextResponse.json({ estilo });
  } catch (error) {
    console.error("[estudio/estilos] salvar:", error);
    return NextResponse.json({ error: `Não foi possível salvar o estilo: ${String(error).slice(0, 200)}` }, { status: 502 });
  }
}
