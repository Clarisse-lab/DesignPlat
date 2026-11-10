// Imagens geradas com IA guardadas no servidor (design_imagens): miniatura e lista para a galeria.

import { imageFileToDataUrl } from "./image";

/** Manda a miniatura de uma imagem recém-gerada (a galeria abre rápido). Falhar aqui não atrapalha nada. */
export async function sendThumbnail(id: string | null | undefined, image: Blob): Promise<void> {
  if (!id) return;
  try {
    const miniatura = await imageFileToDataUrl(new File([image], "mini", { type: image.type || "image/png" }), { maxSide: 420, quality: 0.78 });
    await fetch(`/api/estudio/imagens/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ miniatura }),
    });
  } catch {
    // Sem miniatura a galeria usa a imagem inteira.
  }
}

export interface GeneratedImageSummary {
  id: string;
  cliente_slug: string | null;
  prompt: string;
  estilo: string | null;
  zona: string | null;
  proporcao: string | null;
  editada: boolean;
  com_rosto: boolean;
  miniatura: string | null;
  criado_por: string | null;
  criado_em: string;
}

export async function listGeneratedImages(params: { cliente?: string | null; antes?: string | null; limite?: number }): Promise<GeneratedImageSummary[]> {
  const query = new URLSearchParams();
  if (params.cliente) query.set("cliente", params.cliente);
  if (params.antes) query.set("antes", params.antes);
  query.set("limite", String(params.limite ?? 30));
  const response = await fetch(`/api/estudio/imagens?${query}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error ?? "Não foi possível listar as imagens geradas.");
  return data.imagens as GeneratedImageSummary[];
}

/** A imagem inteira em data URL (para usar no slide) e a zona do texto com que foi gerada. */
export async function fetchGeneratedImage(id: string): Promise<{ imagem: string; zona: string | null; prompt: string }> {
  const response = await fetch(`/api/estudio/imagens/${id}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error ?? "Não foi possível abrir a imagem.");
  return data;
}
