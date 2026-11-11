// Começa a conexão com o Google Drive: devolve o link do Google (a pessoa entra com a conta dona das pastas).

import { NextResponse } from "next/server";
import { publicOrigin } from "@/lib/server/aprovacoes";
import { isResponse, requireMember } from "@/lib/server/auth";
import { authUrl, driveConfigured } from "@/lib/server/drive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  if (!driveConfigured()) return NextResponse.json({ error: "Falta configurar GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no Railway." }, { status: 503 });
  return NextResponse.json({ url: await authUrl(`${publicOrigin(request)}/api/drive/callback`, member.email || null) });
}
