import { NextResponse } from "next/server";
import { feedRenderRequestSchema } from "@/lib/feed/schema";
import { CANVAS_SIZES } from "@/lib/formats";
import { inlineFontCss } from "@/lib/render/fonts";
import { parseSlideIndex, respondWithImages } from "@/lib/render/respond";
import { renderFeedSlide } from "@/lib/templates/feed";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Renderiza os slides do Post de Feed: ?index=N devolve um PNG; sem index, um .zip com todos. */
export async function POST(request: Request) {
  const parsed = feedRenderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos para renderizar." }, { status: 400 });
  }
  const { brand, style, slides } = parsed.data;

  const index = parseSlideIndex(request, slides.length);
  if (index === "invalid") return NextResponse.json({ error: "Slide inexistente." }, { status: 400 });

  const { width, height } = CANVAS_SIZES[style.size];
  const fontCss = inlineFontCss();
  const pages = slides.map((slide, i) => ({
    html: renderFeedSlide({ slide, brand, style, index: i, total: slides.length, fontCss }),
    width,
    height,
  }));

  return respondWithImages({ pages, index, zipName: "post-feed.zip", logTag: "feed/render" });
}
