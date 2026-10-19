import { NextResponse } from "next/server";
import { feedRenderRequestSchema } from "@/lib/feed/schema";
import { CANVAS_SIZES } from "@/lib/formats";
import { buildPptx, mergePdfPages } from "@/lib/presentation/export";
import { inlineFontCss } from "@/lib/render/fonts";
import { renderPagesToPdf, renderPagesToPng } from "@/lib/render/html-to-image";
import { renderFeedSlide, sectionNumberAt } from "@/lib/templates/feed";

export const runtime = "nodejs";
export const maxDuration = 120;

const FORMATS = {
  pdf: { type: "application/pdf", filename: "apresentacao.pdf" },
  pptx: { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation", filename: "apresentacao.pptx" },
} as const;

/** Exporta a apresentação inteira: ?format=pdf (texto selecionável) ou ?format=pptx (slides como imagem + notas). */
export async function POST(request: Request) {
  const format = new URL(request.url).searchParams.get("format");
  if (format !== "pdf" && format !== "pptx") {
    return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
  }
  const parsed = feedRenderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos para exportar." }, { status: 400 });
  }
  const { brand, style, slides } = parsed.data;

  const { width, height } = CANVAS_SIZES[style.size];
  const fontCss = inlineFontCss();
  const pages = slides.map((slide, i) => ({
    html: renderFeedSlide({ slide, brand, style, index: i, total: slides.length, fontCss, sectionNumber: sectionNumberAt(slides, i) }),
    width,
    height,
  }));
  const title = slides[0]?.title.replace(/\*\*/g, "").trim().slice(0, 120) || "Apresentação";

  try {
    const file =
      format === "pdf"
        ? await mergePdfPages(await renderPagesToPdf(pages), title)
        : await buildPptx(
            (await renderPagesToPng(pages)).map((png, i) => ({ png, notes: slides[i].notes })),
            title,
          );
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": FORMATS[format].type,
        "Content-Disposition": `attachment; filename="${FORMATS[format].filename}"`,
      },
    });
  } catch (error) {
    console.error("[presentation/export] falha ao exportar:", error);
    return NextResponse.json({ error: "Falha ao gerar o arquivo." }, { status: 500 });
  }
}
