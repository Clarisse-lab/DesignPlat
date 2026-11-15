// API de integração: o desempenho do cliente no Instagram (formatos, estilos feitos aqui, capa animada,
// melhores carrosséis), para a aba Desempenho da ficha do cliente no Escritório. Protegida pela DESIGN_API_KEY.
// POST { cliente, dias? } → o mesmo resumo da página /desempenho (e liga sozinho as peças novas aos posts pela legenda).

import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api/auth";
import { autoMatches, linkPeca, loadPecas, loadPosts, summarize } from "@/lib/server/desempenho";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = authorizeRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = (await request.json().catch(() => null)) as { cliente?: string; dias?: number } | null;
  const cliente = body?.cliente ?? "";
  // Janela opcional (o Escritório pede 90 dias, a mesma do painel do Instagram); sem ela, 120.
  const dias = Number.isInteger(body?.dias) && body!.dias! >= 30 && body!.dias! <= 365 ? body!.dias! : 120;
  if (!/^[a-z0-9-]{2,60}$/.test(cliente)) return NextResponse.json({ error: "Informe o cliente." }, { status: 400 });
  try {
    const [posts, pecas] = await Promise.all([loadPosts(cliente, dias), loadPecas(cliente)]);
    const matches = autoMatches(pecas, posts);
    await Promise.all(matches.map((m) => linkPeca(m.peca_id, m.media_id, "auto")));
    for (const m of matches) {
      const p = pecas.find((x) => x.id === m.peca_id);
      if (p) Object.assign(p, { post_media_id: m.media_id, post_vinculo: "auto" });
    }
    return NextResponse.json({ ...summarize(posts, pecas), ligadas_agora: matches.length, total_posts: posts.length });
  } catch (error) {
    console.error("[v1/desempenho]", error);
    return NextResponse.json({ error: "Não foi possível carregar o desempenho." }, { status: 502 });
  }
}
