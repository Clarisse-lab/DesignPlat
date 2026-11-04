// API de integração: outros sistemas da Mantora (ex.: o Escritório virtual) enviam uma peça
// em JSON e recebem os PNGs prontos. Protegida pela chave DESIGN_API_KEY.

import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/api/auth";
import { buildFeedPages } from "@/lib/feed/pages";
import { MAX_FEED_SLIDES, pecaRequestSchema } from "@/lib/feed/schema";
import { CANVAS_SIZES, POST_CANVAS_SIZES } from "@/lib/formats";
import { renderPagesToPng } from "@/lib/render/html-to-image";
import { DEFAULT_FEED_STYLE, FEED_DECORS, FEED_LAYOUT_LABELS, FEED_LAYOUTS } from "@/lib/templates/feed";
import { TITLE_FONT_IDS, TITLE_FONTS } from "@/lib/templates/fonts";

export const runtime = "nodejs";
export const maxDuration = 120;

const slideFilename = (index: number) => `slide-${String(index + 1).padStart(2, "0")}.png`;

function denied(auth: { status: number; error: string }) {
  return NextResponse.json({ error: auth.error }, { status: auth.status });
}

/** GET: o que a API aceita (layouts, formatos, fontes, decorações e o estilo padrão). */
export async function GET(request: Request) {
  const auth = authorizeRequest(request);
  if (!auth.ok) return denied(auth);
  return NextResponse.json({
    versao: 1,
    maxSlides: MAX_FEED_SLIDES,
    layouts: FEED_LAYOUTS.filter((id) => id !== "referencia").map((id) => ({ id, nome: FEED_LAYOUT_LABELS[id] })),
    formatos: POST_CANVAS_SIZES.map((id) => ({ id, ...CANVAS_SIZES[id] })),
    fontes: TITLE_FONT_IDS.map((id) => ({ id, nome: TITLE_FONTS[id].label })),
    decoracoes: FEED_DECORS,
    estiloPadrao: DEFAULT_FEED_STYLE,
  });
}

/** POST: renderiza a peça e devolve cada slide em PNG (base64). */
export async function POST(request: Request) {
  const auth = authorizeRequest(request);
  if (!auth.ok) return denied(auth);

  const parsed = pecaRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const detalhes = parsed.error.issues.slice(0, 10).map((issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`);
    return NextResponse.json({ error: "Dados inválidos para renderizar.", detalhes }, { status: 400 });
  }

  const { ref, brand, style, slides } = parsed.data;
  const started = Date.now();
  try {
    const pages = buildFeedPages({ brand: { ...brand, logo: brand.logo ?? null }, style, slides });
    const images = await renderPagesToPng(pages);
    console.info(`[v1/pecas] ref=${ref ?? "-"} slides=${slides.length} ${Date.now() - started}ms`);
    return NextResponse.json({
      slides: images.map((png, index) => ({
        index,
        arquivo: slideFilename(index),
        largura: pages[index].width,
        altura: pages[index].height,
        png: png.toString("base64"),
      })),
    });
  } catch (error) {
    console.error(`[v1/pecas] ref=${ref ?? "-"} falha ao renderizar:`, error);
    return NextResponse.json({ error: "Falha ao gerar as imagens." }, { status: 500 });
  }
}
