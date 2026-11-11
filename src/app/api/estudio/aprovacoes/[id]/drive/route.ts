// Sobe de novo para o Drive uma peça já aprovada (quando o envio automático falhou).

import { NextResponse } from "next/server";
import { loadById, sendToDrive } from "@/lib/server/aprovacoes";
import { isResponse, requireMember } from "@/lib/server/auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Aprovação inválida." }, { status: 400 });
  const row = await loadById(id).catch(() => null);
  if (!row) return NextResponse.json({ error: "Aprovação não encontrada." }, { status: 404 });
  try {
    return NextResponse.json({ drive_url: await sendToDrive(row) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao enviar ao Drive." }, { status: 502 });
  }
}
