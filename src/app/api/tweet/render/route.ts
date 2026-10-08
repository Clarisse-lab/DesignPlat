import JSZip from "jszip";
import { NextResponse } from "next/server";
import { CANVAS_SIZES } from "@/lib/formats";
import { inlineFontCss } from "@/lib/render/fonts";
import { renderPagesToPng } from "@/lib/render/html-to-image";
import { renderTweetSlide } from "@/lib/templates/tweet";
import { renderRequestSchema } from "@/lib/tweet/schema";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Renderiza os slides em PNG.
 * - ?index=N  → devolve só o slide N (0-based) como image/png
 * - sem index → devolve um .zip com todos os slides
 */
export async function POST(request: Request) {
  const parsed = renderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos para renderizar." }, { status: 400 });
  }
  const { profile, style, slides } = parsed.data;

  const indexParam = new URL(request.url).searchParams.get("index");
  const index = indexParam === null ? null : Number(indexParam);
  if (index !== null && (!Number.isInteger(index) || index < 0 || index >= slides.length)) {
    return NextResponse.json({ error: "Slide inexistente." }, { status: 400 });
  }

  const { width, height } = CANVAS_SIZES[style.size];
  const fontCss = inlineFontCss();
  const selected = index === null ? slides : [slides[index]];
  const pages = selected.map((slide) => ({
    html: renderTweetSlide({ slide, profile, style, fontCss }),
    width,
    height,
  }));

  try {
    const images = await renderPagesToPng(pages);

    if (index !== null) {
      return new Response(new Uint8Array(images[0]), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="slide-${String(index + 1).padStart(2, "0")}.png"`,
        },
      });
    }

    const zip = new JSZip();
    images.forEach((image, i) => zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, image));
    const archive = await zip.generateAsync({ type: "arraybuffer" });
    return new Response(archive, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="carrossel-tweet.zip"',
      },
    });
  } catch (error) {
    console.error("[tweet/render] falha ao renderizar:", error);
    return NextResponse.json({ error: "Falha ao gerar as imagens." }, { status: 500 });
  }
}
