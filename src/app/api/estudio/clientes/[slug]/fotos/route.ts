import { NextResponse } from "next/server";
import { isResponse, requireMember } from "@/lib/server/auth";
import { callFunction } from "@/lib/server/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Midias {
  conta: { username: string; foto: string | null };
  imagens: { url: string; permalink: string; tela: string; nota: number }[];
}

/**
 * Fotos recentes do Instagram do próprio cliente (posts de imagem e carrossel), para usar de fundo
 * ou como rosto de referência na imagem gerada. As imagens passam pelo proxy /api/estudio/foto.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  try {
    const midias = await callFunction<Midias>("instagram-midias", `?cliente=${encodeURIComponent(slug)}&limite=20`);
    const proxied = (url: string) => `/api/estudio/foto?url=${encodeURIComponent(url)}`;
    return NextResponse.json({
      perfil: midias.conta.foto ? proxied(midias.conta.foto) : null,
      fotos: midias.imagens.map((i) => ({ src: proxied(i.url), permalink: i.permalink })),
    });
  } catch (error) {
    return NextResponse.json({ error: `Não deu para ler o Instagram do cliente: ${String(error).slice(0, 200)}` }, { status: 502 });
  }
}
