import { NextResponse } from "next/server";
import { isResponse, requireMember } from "@/lib/server/auth";
import { restoreImages, type Json } from "@/lib/server/pecas";
import { rest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;

/** GET: a peça inteira, com as imagens de volta em data URL. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Peça inválida." }, { status: 400 });
  try {
    const rows = await rest<{ dados: Json; [k: string]: unknown }[]>(`design_pecas?id=eq.${id}&select=*`);
    if (!rows[0]) return NextResponse.json({ error: "Peça não encontrada." }, { status: 404 });
    return NextResponse.json({ ...rows[0], dados: await restoreImages(rows[0].dados) });
  } catch (error) {
    console.error("[estudio/pecas] abrir:", error);
    return NextResponse.json({ error: "Não foi possível abrir a peça." }, { status: 502 });
  }
}

/** DELETE: apaga a peça (as imagens ficam no Storage, podem estar em outras peças). */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Peça inválida." }, { status: 400 });
  try {
    await rest(`design_pecas?id=eq.${id}`, { method: "DELETE" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[estudio/pecas] apagar:", error);
    return NextResponse.json({ error: "Não foi possível apagar." }, { status: 502 });
  }
}
