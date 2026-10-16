import { NextResponse } from "next/server";
import { CANVAS_SIZES } from "@/lib/formats";
import { inlineFontCss } from "@/lib/render/fonts";
import { parseSlideIndex, respondWithImages } from "@/lib/render/respond";
import { renderTweetSlide } from "@/lib/templates/tweet";
import { renderRequestSchema } from "@/lib/tweet/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Renderiza os slides do Carrossel Tweet: ?index=N devolve um PNG; sem index, um .zip com todos. */
export async function POST(request: Request) {
  const parsed = renderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos para renderizar." }, { status: 400 });
  }
  const { profile, style, slides } = parsed.data;

  const index = parseSlideIndex(request, slides.length);
  if (index === "invalid") return NextResponse.json({ error: "Slide inexistente." }, { status: 400 });

  const { width, height } = CANVAS_SIZES[style.size];
  const fontCss = inlineFontCss();
  const pages = slides.map((slide) => ({ html: renderTweetSlide({ slide, profile, style, fontCss }), width, height }));

  return respondWithImages({ pages, index, zipName: "carrossel-tweet.zip", logTag: "tweet/render" });
}
