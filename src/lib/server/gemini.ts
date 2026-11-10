import "server-only";
// Geração de imagem com o Gemini (a mesma conta do Prisma). Chave só no Railway: GEMINI_API_KEY.
// Modelo trocável por GEMINI_IMAGE_MODEL; o preço por imagem entra no custo registrado em uso_ia.
// As instruções (zona do texto, estilo, variação, rosto) são montadas em lib/ai/image-direction.ts.

import { buildImageInstructions, type ImageStyle, type TextZone } from "../ai/image-direction";

const clean = (value: string | undefined) => (value ?? "").trim().replace(/^[<"']+|[>"']+$/g, "");
const API_KEY = clean(process.env.GEMINI_API_KEY);
export const IMAGE_MODEL = clean(process.env.GEMINI_IMAGE_MODEL) || "gemini-2.5-flash-image";

/** US$ por imagem (tabela pública do Gemini em nov/2026). Modelo fora da lista usa GEMINI_PRECO_IMAGEM_USD. */
const PRICES: Record<string, number> = {
  "gemini-2.5-flash-image": 0.039,
  "gemini-3.1-flash-image-preview": 0.067,
  "gemini-3.1-flash-image": 0.067,
  "gemini-3-pro-image-preview": 0.134,
};
export const pricePerImage = () => Number(process.env.GEMINI_PRECO_IMAGEM_USD) || PRICES[IMAGE_MODEL] || 0.067;
export const geminiConfigured = () => Boolean(API_KEY);

/** Proporções aceitas pelo Gemini, a partir do tamanho do slide. */
export function aspectFor(width: number, height: number): string {
  const options: [string, number][] = [["1:1", 1], ["4:5", 0.8], ["3:4", 0.75], ["9:16", 0.5625], ["16:9", 16 / 9], ["21:9", 21 / 9], ["2:3", 2 / 3], ["3:2", 1.5]];
  const ratio = width / height;
  return options.reduce((best, option) => (Math.abs(option[1] - ratio) < Math.abs(best[1] - ratio) ? option : best))[0];
}

export interface GeneratedImage {
  mimeType: string;
  base64: string;
  inputTokens: number;
  outputTokens: number;
}

function dataUrlPart(dataUrl: string) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Imagem de referência inválida.");
  return { inline_data: { mime_type: match[1], data: match[2] } };
}

export async function generateImage(input: {
  prompt: string;
  aspectRatio: string;
  faces: string[];
  references: string[];
  paletteHint?: string;
  /** Editar esta imagem em vez de criar uma nova (vai como a primeira imagem do pedido). */
  base?: string | null;
  /** Onde o layout põe o texto: a IA deixa essa área livre. */
  textZone?: TextZone;
  style?: ImageStyle;
  /** Fragmentos de luz, enquadramento e fundo sorteados (pickVariation). */
  variation?: string[];
}): Promise<GeneratedImage> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY não configurada no Railway.");
  const instructions = buildImageInstructions({
    prompt: input.prompt,
    aspectRatio: input.aspectRatio,
    hasFaces: input.faces.length > 0,
    hasReferences: input.references.length > 0,
    paletteHint: input.paletteHint,
    editing: Boolean(input.base),
    textZone: input.textZone,
    style: input.style,
    variation: input.variation,
  });

  const parts = [
    { text: instructions },
    ...(input.base ? [dataUrlPart(input.base)] : []),
    ...input.faces.map(dataUrlPart),
    ...input.references.map(dataUrlPart),
  ];
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": API_KEY },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: input.aspectRatio } },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gemini ${response.status}: ${data?.error?.message ?? "erro"}`.slice(0, 300));

  const candidate = data?.candidates?.[0];
  const image = (candidate?.content?.parts ?? []).find((p: { inlineData?: { mimeType?: string }; thought?: boolean }) =>
    p.inlineData?.mimeType?.startsWith("image/") && !p.thought,
  );
  if (!image) {
    const reason = data?.promptFeedback?.blockReason || candidate?.finishReason || "sem imagem na resposta";
    throw new Error(`O Gemini não gerou a imagem (${reason}). Tente reescrever o pedido.`);
  }
  return {
    mimeType: image.inlineData.mimeType,
    base64: image.inlineData.data,
    inputTokens: data?.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
