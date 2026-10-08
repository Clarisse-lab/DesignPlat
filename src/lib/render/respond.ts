import "server-only";
import JSZip from "jszip";
import { NextResponse } from "next/server";
import { renderPagesToPng, type HtmlPage } from "./html-to-image";

/** Lê o parâmetro ?index=N (0-based). Retorna null quando ausente e "invalid" quando fora do intervalo. */
export function parseSlideIndex(request: Request, total: number): number | null | "invalid" {
  const raw = new URL(request.url).searchParams.get("index");
  if (raw === null) return null;
  const index = Number(raw);
  return Number.isInteger(index) && index >= 0 && index < total ? index : "invalid";
}

const slideFilename = (index: number) => `slide-${String(index + 1).padStart(2, "0")}.png`;

/**
 * Renderiza as páginas e responde com um PNG (quando `index` é informado)
 * ou com um .zip contendo todas.
 */
export async function respondWithImages(params: {
  pages: HtmlPage[];
  index: number | null;
  zipName: string;
  logTag: string;
}): Promise<Response> {
  const { pages, index, zipName, logTag } = params;
  try {
    if (index !== null) {
      const [image] = await renderPagesToPng([pages[index]]);
      return new Response(new Uint8Array(image), {
        headers: {
          "Content-Type": "image/png",
          "Content-Disposition": `attachment; filename="${slideFilename(index)}"`,
        },
      });
    }

    const images = await renderPagesToPng(pages);
    const zip = new JSZip();
    images.forEach((image, i) => zip.file(slideFilename(i), image));
    const archive = await zip.generateAsync({ type: "arraybuffer" });
    return new Response(archive, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
      },
    });
  } catch (error) {
    console.error(`[${logTag}] falha ao renderizar:`, error);
    return NextResponse.json({ error: "Falha ao gerar as imagens." }, { status: 500 });
  }
}
