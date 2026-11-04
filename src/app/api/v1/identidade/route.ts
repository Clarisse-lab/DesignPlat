// API de integração: lê a identidade visual de um cliente a partir dos posts do Instagram
// e devolve um kit de marca sugerido (paleta, alinhamento, posição, tamanho do título, layouts).
// Quem chama (o Escritório) já escolheu os posts e manda as URLs atuais das imagens.

import { NextResponse } from "next/server";
import { z } from "zod";
import type { BridgeImage } from "@/components/analysis/AnalysisBridge";
import { authorizeRequest } from "@/lib/api/auth";
import { aggregateReadings, type Reading } from "@/lib/reference/aggregate";
import { analyzeImages, downloadImageAsDataUrl } from "@/lib/reference/identity";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IMAGES = 24;
/** O OCR é a parte lenta: roda só nas imagens de maior peso. */
const MAX_OCR = 12;
const PARALLEL_DOWNLOADS = 4;

const requestSchema = z.object({
  ref: z.string().max(100).optional(),
  imagens: z
    .array(
      z.object({
        url: z.string().url().max(2000),
        peso: z.number().min(0).max(1000).optional(),
        tela: z.enum(["capa", "interna"]).optional(),
      }),
    )
    .min(1)
    .max(MAX_IMAGES),
  /** Foto de perfil do Instagram, devolvida em data URL para virar o logo do kit. */
  logo: z.string().url().max(2000).nullish(),
});

async function mapLimited<T, R>(items: T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await run(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function POST(request: Request) {
  const auth = authorizeRequest(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const detalhes = parsed.error.issues.slice(0, 10).map((issue) => `${issue.path.join(".") || "(raiz)"}: ${issue.message}`);
    return NextResponse.json({ error: "Dados inválidos.", detalhes }, { status: 400 });
  }
  const { ref, imagens, logo } = parsed.data;
  const started = Date.now();

  try {
    const downloads = await mapLimited(imagens, PARALLEL_DOWNLOADS, async (img) => {
      try {
        return { src: await downloadImageAsDataUrl(img.url), error: null };
      } catch (error) {
        return { src: null, error: String(error) };
      }
    });

    // OCR nas imagens de maior peso; as demais entram só com a paleta.
    const ocrOrder = imagens
      .map((img, index) => ({ index, weight: img.peso ?? 0 }))
      .filter(({ index }) => downloads[index].src)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_OCR)
      .map(({ index }) => index);
    const ocrSet = new Set(ocrOrder);

    const toAnalyze: { index: number; image: BridgeImage }[] = downloads.flatMap((d, index) =>
      d.src ? [{ index, image: { src: d.src, ocr: ocrSet.has(index) } }] : [],
    );
    const results = await analyzeImages(toAnalyze.map((t) => t.image));

    const leituras = imagens.map((img, index) => {
      const at = toAnalyze.findIndex((t) => t.index === index);
      const result = at >= 0 ? results[at] : null;
      return {
        url: img.url,
        tela: img.tela ?? "capa",
        peso: img.peso ?? 0,
        paleta: result?.palette ?? null,
        layout: result?.layout ?? null,
        erro: downloads[index].error ?? result?.error ?? null,
      };
    });

    const readings: Reading[] = leituras.flatMap((l) =>
      l.paleta ? [{ weight: l.peso, palette: l.paleta, layout: l.layout, slot: l.tela }] : [],
    );
    const kit = aggregateReadings(readings);

    let logoDataUrl: string | null = null;
    if (logo) {
      try {
        logoDataUrl = await downloadImageAsDataUrl(logo);
      } catch (error) {
        console.warn(`[v1/identidade] ref=${ref ?? "-"} logo não baixou:`, error);
      }
    }

    console.info(`[v1/identidade] ref=${ref ?? "-"} imagens=${imagens.length} lidas=${readings.length} ${Date.now() - started}ms`);
    return NextResponse.json({
      kit,
      logo: logoDataUrl,
      analisadas: readings.length,
      falharam: leituras.filter((l) => l.erro).length,
      leituras,
    });
  } catch (error) {
    console.error(`[v1/identidade] ref=${ref ?? "-"} falha:`, error);
    return NextResponse.json({ error: "Falha ao ler a identidade." }, { status: 500 });
  }
}
