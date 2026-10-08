import type { GeneratedCarousel, GenerateRequest } from "../tweet/schema";

async function errorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export async function generateCarousel(input: GenerateRequest): Promise<GeneratedCarousel> {
  const response = await fetch("/api/tweet/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "Erro ao gerar o carrossel."));
  return response.json();
}

/**
 * Renderiza no servidor e dispara o download.
 * Com `index`, baixa só aquele slide em PNG; sem `index`, baixa todos em .zip.
 */
export async function downloadRender(
  endpoint: string,
  input: unknown,
  options: { index?: number; zipName: string },
): Promise<void> {
  const { index, zipName } = options;
  const query = index === undefined ? "" : `?index=${index}`;
  const response = await fetch(`${endpoint}${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await errorMessage(response, "Erro ao gerar as imagens."));

  const blob = await response.blob();
  const filename = index === undefined ? zipName : `slide-${String(index + 1).padStart(2, "0")}.png`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
