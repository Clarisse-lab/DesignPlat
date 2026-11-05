import { NextResponse } from "next/server";
import { isResponse, requireMember } from "@/lib/server/auth";
import { rest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Pautas do Motor de Conteúdo com copy pronta (aprovadas ou em produção) de um cliente. */
export async function GET(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const cliente = new URL(request.url).searchParams.get("cliente") ?? "";
  if (!/^[a-z0-9-]{2,60}$/.test(cliente)) return NextResponse.json({ pautas: [] });
  try {
    const pautas = await rest(
      `pautas?select=id,titulo,formato,status,atualizado_em&cliente_slug=eq.${cliente}&copy=not.is.null&status=in.(aprovada,em_producao,publicada)&order=atualizado_em.desc&limit=40`,
    );
    return NextResponse.json({ pautas });
  } catch (error) {
    console.error("[estudio/pautas]", error);
    return NextResponse.json({ error: "Não foi possível ler as pautas." }, { status: 502 });
  }
}
