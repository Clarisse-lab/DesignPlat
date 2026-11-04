import { NextResponse } from "next/server";
import { buildFeedPages } from "@/lib/feed/pages";
import { feedRenderRequestSchema } from "@/lib/feed/schema";
import { parseSlideIndex, respondWithImages } from "@/lib/render/respond";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Renderiza os slides do Post de Feed, Story ou Apresentação: ?index=N devolve um PNG; sem index, um .zip com todos. */
export async function POST(request: Request) {
  const parsed = feedRenderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos para renderizar." }, { status: 400 });
  }
  const { slides } = parsed.data;

  const index = parseSlideIndex(request, slides.length);
  if (index === "invalid") return NextResponse.json({ error: "Slide inexistente." }, { status: 400 });

  const pages = buildFeedPages(parsed.data);
  return respondWithImages({ pages, index, zipName: "post-feed.zip", logTag: "feed/render" });
}
