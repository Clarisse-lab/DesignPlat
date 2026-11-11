// Google Drive: status da conexão e a pasta de cada cliente.

import { NextResponse } from "next/server";
import { isResponse, requireMember } from "@/lib/server/auth";
import { driveConfigured, driveStatus } from "@/lib/server/drive";
import { rest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  try {
    const [status, clientes, pastas] = await Promise.all([
      driveStatus(),
      rest<{ slug: string; nome: string }[]>("clientes?ativo=is.true&select=slug,nome&order=nome.asc"),
      rest<{ cliente_slug: string; pasta_id: string; pasta_nome: string | null }[]>("design_drive_pastas?select=cliente_slug,pasta_id,pasta_nome"),
    ]);
    const bySlug = new Map(pastas.map((p) => [p.cliente_slug, p]));
    return NextResponse.json({
      configurado: driveConfigured(),
      conectado: status,
      clientes: clientes.map((c) => ({ ...c, pasta: bySlug.get(c.slug) ?? null })),
    });
  } catch (error) {
    console.error("[drive]", error);
    return NextResponse.json({ error: "Não foi possível carregar o Drive." }, { status: 502 });
  }
}
