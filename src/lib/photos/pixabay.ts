import "server-only";

// Busca de fotos gratuitas no Pixabay (https://pixabay.com/api/docs/). Requer PIXABAY_API_KEY.
// Os termos do Pixabay pedem cache das buscas por 24 h e proíbem hotlink: o resultado fica
// em memória e a foto escolhida é baixada e embutida no slide.

export interface StockPhoto {
  id: number;
  alt: string;
  photographer: string;
  pageUrl: string;
  thumb: string;
  full: string;
}

export class PhotosUnavailableError extends Error {}

interface PixabayHit {
  id: number;
  pageURL: string;
  tags: string;
  webformatURL: string;
  largeImageURL: string;
  user: string;
}

const PER_PAGE = 24;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; value: { photos: StockPhoto[]; hasMore: boolean } }>();

export async function searchPixabay(query: string, page: number): Promise<{ photos: StockPhoto[]; hasMore: boolean }> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) throw new PhotosUnavailableError("Configure PIXABAY_API_KEY no servidor para buscar fotos.");

  const cacheKey = `${query.toLowerCase()}|${page}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(PER_PAGE));
  url.searchParams.set("lang", "pt");
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("safesearch", "true");

  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new PhotosUnavailableError("Chave do Pixabay inválida.");
  }
  if (response.status === 429) throw new PhotosUnavailableError("Muitas buscas seguidas. Espere um minuto e tente de novo.");
  if (!response.ok) throw new Error(`Pixabay respondeu ${response.status}`);

  const data = (await response.json()) as { totalHits: number; hits: PixabayHit[] };
  const value = {
    hasMore: page * PER_PAGE < Math.min(data.totalHits, 500),
    photos: data.hits.map((hit) => ({
      id: hit.id,
      alt: hit.tags,
      photographer: hit.user,
      pageUrl: hit.pageURL,
      thumb: hit.webformatURL,
      full: hit.largeImageURL,
    })),
  };

  if (cache.size > 500) cache.clear();
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

/** Só baixa imagens do Pixabay, para a rota de download não virar um proxy aberto. */
export function isPixabayImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "pixabay.com" || url.hostname === "cdn.pixabay.com");
  } catch {
    return false;
  }
}
