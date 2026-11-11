// Desempenho por cliente (métricas do Instagram × peças feitas aqui).
// GET ?cliente=slug: liga sozinho as peças novas aos posts pela legenda e devolve o resumo.
// POST { peca_id, media_id | null }: liga (ou desliga) uma peça a um post à mão.

import { NextResponse } from "next/server";
import { z } from "zod";
import { isResponse, requireMember } from "@/lib/server/auth";
import { autoMatches, linkPeca, loadPecas, loadPosts, summarize } from "@/lib/server/desempenho";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const cliente = new URL(request.url).searchParams.get("cliente") ?? "";
  if (!/^[a-z0-9-]{2,60}$/.test(cliente)) return NextResponse.json({ error: "Escolha um cliente." }, { status: 400 });
  try {
    const [posts, pecas] = await Promise.all([loadPosts(cliente), loadPecas(cliente)]);
    const matches = autoMatches(pecas, posts);
    await Promise.all(matches.map((m) => linkPeca(m.peca_id, m.media_id, "auto")));
    for (const m of matches) {
      const p = pecas.find((x) => x.id === m.peca_id);
      if (p) Object.assign(p, { post_media_id: m.media_id, post_vinculo: "auto" });
    }
    return NextResponse.json({ ...summarize(posts, pecas), ligadas_agora: matches.length, total_posts: posts.length });
  } catch (error) {
    console.error("[estudio/desempenho]", error);
    return NextResponse.json({ error: "Não foi possível carregar o desempenho." }, { status: 502 });
  }
}

const linkSchema = z.object({ peca_id: z.string().uuid(), media_id: z.string().regex(/^\d{5,40}$/).nullable() });

export async function POST(request: Request) {
  const member = await requireMember(request, { strict: true });
  if (isResponse(member)) return member;
  const parsed = linkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  try {
    await linkPeca(parsed.data.peca_id, parsed.data.media_id, "manual");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[estudio/desempenho] ligar:", error);
    return NextResponse.json({ error: "Não foi possível ligar a peça ao post." }, { status: 502 });
  }
}
