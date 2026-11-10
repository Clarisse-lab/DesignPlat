import "server-only";
// Imagens geradas com IA: toda imagem que o Gemini devolve fica guardada (bucket privado "design",
// pasta geradas/) com uma linha em design_imagens, mesmo que ninguém use no slide.
// Assim nada do que foi pago se perde e a equipe pode reaproveitar depois.

import { createHash } from "node:crypto";
import { rest, uploadObject } from "./supabase";

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export interface ImagemMeta {
  clienteSlug: string | null;
  prompt: string;
  estilo: string | null;
  zona: string | null;
  proporcao: string;
  editada: boolean;
  comRosto: boolean;
  modelo: string;
  custoUsd: number;
  criadoPor: string | null;
}

/** Sobe a imagem e registra. Devolve o id da linha. */
export async function saveGeneratedImage(image: { mimeType: string; base64: string }, meta: ImagemMeta): Promise<string> {
  const bytes = Buffer.from(image.base64, "base64");
  const ext = EXT[image.mimeType] ?? "png";
  const hash = createHash("sha256").update(bytes).digest("hex");
  const caminho = `geradas/${hash}.${ext}`;
  await uploadObject(caminho, bytes, image.mimeType in EXT ? image.mimeType : "image/png");
  const rows = await rest<{ id: string }[]>("design_imagens?select=id", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      cliente_slug: meta.clienteSlug,
      prompt: meta.prompt.slice(0, 2000),
      estilo: meta.estilo,
      zona: meta.zona,
      proporcao: meta.proporcao,
      editada: meta.editada,
      com_rosto: meta.comRosto,
      modelo: meta.modelo,
      custo_usd: meta.custoUsd.toFixed(4),
      caminho,
      criado_por: meta.criadoPor,
    }),
  });
  if (!rows[0]) throw new Error("design_imagens não devolveu o id");
  return rows[0].id;
}

const JPEG_DATA_URL = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/;

/** Guarda a miniatura (JPEG pequeno feito no navegador) de uma imagem gerada. */
export async function saveThumbnail(id: string, dataUrl: string): Promise<void> {
  const match = JPEG_DATA_URL.exec(dataUrl);
  if (!match) throw new Error("Miniatura inválida.");
  const caminho = `geradas/miniaturas/${id}.jpg`;
  await uploadObject(caminho, Buffer.from(match[1], "base64"), "image/jpeg");
  await rest(`design_imagens?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ miniatura: caminho }),
  });
}
