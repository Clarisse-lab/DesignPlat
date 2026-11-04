import "server-only";
// Geração de imagem com o Gemini (a mesma conta do Prisma). Chave só no Railway: GEMINI_API_KEY.
// Modelo trocável por GEMINI_IMAGE_MODEL; o preço por imagem entra no custo registrado em uso_ia.

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
  const options: [string, number][] = [["1:1", 1], ["4:5", 0.8], ["3:4", 0.75], ["9:16", 0.5625], ["16:9", 16 / 9], ["2:3", 2 / 3], ["3:2", 1.5]];
  const ratio = width / height;
  return options.reduce((best, option) => (Math.abs(option[1] - ratio) < Math.abs(best[1] - ratio) ? option : best))[0];
}

const RULES = [
  "Create a single high-quality image for an Instagram post.",
  "Absolutely no text, letters, numbers, captions, logos or watermarks anywhere in the image.",
  "Keep the lower third calm and darker so a headline can be placed over it.",
  "Do not depict any real, identifiable public figure or celebrity.",
].join(" ");

const FACE_RULE =
  "The person in the generated image must be the same person shown in the reference photo(s): keep the face, facial features, skin tone, hair and age faithful. Do not add other identifiable people.";

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
}): Promise<GeneratedImage> {
  if (!API_KEY) throw new Error("GEMINI_API_KEY não configurada no Railway.");
  const instructions = [
    RULES,
    input.faces.length ? FACE_RULE : "",
    input.references.length ? "Use the other reference image(s) only as visual style/composition inspiration." : "",
    input.paletteHint ? `Brand colors to echo subtly: ${input.paletteHint}.` : "",
    `Scene requested by the user (Portuguese): ${input.prompt}`,
  ]
    .filter(Boolean)
    .join("\n");

  const parts = [{ text: instructions }, ...input.faces.map(dataUrlPart), ...input.references.map(dataUrlPart)];
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
