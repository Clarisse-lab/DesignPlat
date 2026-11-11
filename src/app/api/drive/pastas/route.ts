// Define a pasta do Drive de um cliente (link ou id da pasta do cliente em "01 | CLIENTES ATIVOS").

import { NextResponse } from "next/server";
import { z } from "zod";
import { isResponse, requireMember } from "@/lib/server/auth";
import { getFolder } from "@/lib/server/drive";
import { rest } from "@/lib/server/supabase";

export const runtime = "nodejs";

const schema = z.object({ cliente_slug: z.string().regex(/^[a-z0-9-]{2,60}$/), pasta: z.string().trim().min(10).max(300) });

export async function PUT(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Cole o link da pasta do cliente." }, { status: 400 });
  const id = parsed.data.pasta.match(/folders\/([A-Za-z0-9_-]{10,})/)?.[1] ?? parsed.data.pasta.match(/^[A-Za-z0-9_-]{10,}$/)?.[0];
  if (!id) return NextResponse.json({ error: "Não reconheci o link da pasta." }, { status: 400 });
  try {
    const folder = await getFolder(id);
    await rest("design_drive_pastas", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ cliente_slug: parsed.data.cliente_slug, pasta_id: folder.id, pasta_nome: folder.name, atualizado_em: new Date().toISOString() }),
    });
    return NextResponse.json({ pasta: { pasta_id: folder.id, pasta_nome: folder.name } });
  } catch (error) {
    console.error("[drive/pastas]", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não consegui abrir a pasta." }, { status: 502 });
  }
}
