// Uma imagem já gerada: GET devolve a imagem em data URL (para usar no slide);
// PUT guarda a miniatura feita no navegador (para a galeria abrir rápido).

import { NextResponse } from "next/server";
import { z } from "zod";
import { isResponse, requireMember } from "@/lib/server/auth";
import { saveThumbnail } from "@/lib/server/imagens";
import { downloadObject, rest } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
  try {
    const rows = await rest<{ caminho: string; zona: string | null; prompt: string }[]>(`design_imagens?id=eq.${id}&select=caminho,zona,prompt`);
    if (!rows[0]) return NextResponse.json({ error: "Imagem não encontrada." }, { status: 404 });
    const { bytes, contentType } = await downloadObject(rows[0].caminho);
    return NextResponse.json({
      imagem: `data:${contentType.split(";")[0]};base64,${bytes.toString("base64")}`,
      zona: rows[0].zona,
      prompt: rows[0].prompt,
    });
  } catch (error) {
    console.error("[estudio/imagens] abrir:", error);
    return NextResponse.json({ error: "Não foi possível abrir a imagem." }, { status: 502 });
  }
}

const thumbSchema = z.object({ miniatura: z.string().max(400_000).regex(/^data:image\/jpeg;base64,/) });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Imagem inválida." }, { status: 400 });
  const parsed = thumbSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Miniatura inválida." }, { status: 400 });
  try {
    await saveThumbnail(id, parsed.data.miniatura);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[estudio/imagens] miniatura:", error);
    return NextResponse.json({ error: "Não foi possível guardar a miniatura." }, { status: 502 });
  }
}
