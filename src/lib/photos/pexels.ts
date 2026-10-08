import "server-only";

// Busca de fotos gratuitas no Pexels (https://www.pexels.com/api/). Requer PEXELS_API_KEY.

export interface StockPhoto {
  id: number;
  alt: string;
  photographer: string;
  photographerUrl: string;
  pageUrl: string;
  thumb: string;
  full: string;
}

export class PhotosUnavailableError extends Error {}

interface PexelsPhoto {
  id: number;
  url: string;
  alt: string | null;
  photographer: string;
  photographer_url: string;
  src: { medium: string; large2x: string };
}

export async function searchPexels(query: string, page: number): Promise<{ photos: StockPhoto[]; hasMore: boolean }> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new PhotosUnavailableError("Configure PEXELS_API_KEY no servidor para buscar fotos.");

  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", "24");
  url.searchParams.set("locale", "pt-BR");

  const response = await fetch(url, { headers: { Authorization: key }, cache: "no-store" });
  if (response.status === 401 || response.status === 403) throw new PhotosUnavailableError("Chave do Pexels inválida.");
  if (!response.ok) throw new Error(`Pexels respondeu ${response.status}`);

  const data = (await response.json()) as { photos: PexelsPhoto[]; next_page?: string };
  return {
    hasMore: Boolean(data.next_page),
    photos: data.photos.map((p) => ({
      id: p.id,
      alt: p.alt ?? "",
      photographer: p.photographer,
      photographerUrl: p.photographer_url,
      pageUrl: p.url,
      thumb: p.src.medium,
      full: p.src.large2x,
    })),
  };
}

/** Só baixa imagens do CDN do Pexels, para a rota não virar um proxy aberto. */
export function isPexelsImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "images.pexels.com";
  } catch {
    return false;
  }
}
