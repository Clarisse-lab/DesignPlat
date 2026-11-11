import JSZip from "jszip";
import { NextResponse } from "next/server";
import { buildFeedPages } from "@/lib/feed/pages";
import { feedRenderRequestSchema } from "@/lib/feed/schema";
import { renderPagesToPng } from "@/lib/render/html-to-image";
import { renderHtmlToMp4 } from "@/lib/render/html-to-video";
import { parseSlideIndex, respondWithImages } from "@/lib/render/respond";
import { isResponse, requireMember } from "@/lib/server/auth";
import { hasMotion, motionDuration, type FreeSlide } from "@/lib/templates/free";

export const runtime = "nodejs";
export const maxDuration = 300;

const animated = (slide: { layout: string; free?: unknown }) => slide.layout === "livre" && hasMotion(slide.free as FreeSlide | null);
const pad = (i: number) => String(i + 1).padStart(2, "0");

/**
 * Renderiza os slides do Post de Feed, Story ou Apresentação: ?index=N devolve um PNG; sem index, um .zip com todos.
 * Telas com animação: ?index=N&video=1 devolve o MP4 da tela; no .zip, elas vão como MP4 (as outras, PNG).
 */
export async function POST(request: Request) {
  const member = await requireMember(request);
  if (isResponse(member)) return member;

  const parsed = feedRenderRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos para renderizar." }, { status: 400 });
  }
  const { slides } = parsed.data;

  const index = parseSlideIndex(request, slides.length);
  if (index === "invalid") return NextResponse.json({ error: "Slide inexistente." }, { status: 400 });
  const wantsVideo = new URL(request.url).searchParams.get("video") === "1";

  const pages = buildFeedPages(parsed.data);
  const motionIdx = slides.map((s, i) => (animated(s) ? i : -1)).filter((i) => i >= 0);
  if (!wantsVideo && (index !== null || !motionIdx.length)) {
    return respondWithImages({ pages, index, zipName: "post-feed.zip", logTag: "feed/render" });
  }

  try {
    const animatedPages = buildFeedPages(parsed.data, { animate: true });
    const video = (i: number) => renderHtmlToMp4({ ...animatedPages[i], seconds: motionDuration(slides[i].free as FreeSlide) });
    if (index !== null) {
      if (!animated(slides[index])) return NextResponse.json({ error: "Esta tela não tem animação." }, { status: 400 });
      const mp4 = await video(index);
      return new Response(new Uint8Array(mp4), {
        headers: { "Content-Type": "video/mp4", "Content-Disposition": `attachment; filename="slide-${pad(index)}.mp4"` },
      });
    }
    // Carrossel inteiro: telas paradas em PNG e as animadas em MP4 (um vídeo por vez, para não pesar o servidor).
    const still = slides.map((_, i) => i).filter((i) => !motionIdx.includes(i));
    const pngs = await renderPagesToPng(still.map((i) => pages[i]));
    const zip = new JSZip();
    still.forEach((i, k) => zip.file(`slide-${pad(i)}.png`, pngs[k]));
    for (const i of motionIdx) zip.file(`slide-${pad(i)}.mp4`, await video(i));
    const archive = await zip.generateAsync({ type: "arraybuffer" });
    return new Response(archive, { headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="post-feed.zip"' } });
  } catch (error) {
    console.error("[feed/render] falha no vídeo:", error);
    return NextResponse.json({ error: `Falha ao gerar o vídeo: ${String(error).slice(0, 160)}` }, { status: 500 });
  }
}
