"use client";

import { useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { imageFileToDataUrl } from "@/lib/client/image";
import { inputClass } from "./ui";

interface StockPhoto {
  id: number;
  alt: string;
  photographer: string;
  pageUrl: string;
  thumb: string;
  full: string;
}

/** Janela de busca de fotos gratuitas (Pixabay). A foto escolhida volta como data URL. */
export function PhotoSearch({ onPick, onClose }: { onPick: (dataUrl: string, credit: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const search = async (nextPage: number) => {
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/photos/search?q=${encodeURIComponent(query.trim())}&page=${nextPage}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Erro ao buscar fotos.");
      setPhotos((current) => (nextPage === 1 ? data.photos : [...current, ...data.photos]));
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar fotos.");
    } finally {
      setLoading(false);
    }
  };

  const pick = async (photo: StockPhoto) => {
    setPicking(photo.id);
    setError(null);
    try {
      const response = await fetch(`/api/photos/image?url=${encodeURIComponent(photo.full)}`);
      if (!response.ok) throw new Error("Não foi possível baixar a foto.");
      const blob = await response.blob();
      const dataUrl = await imageFileToDataUrl(new File([blob], "foto", { type: blob.type }), { maxSide: 1600 });
      onPick(dataUrl, `Foto: ${photo.photographer} / Pixabay`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao usar a foto.");
    } finally {
      setPicking(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Buscar fotos">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-surface p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Buscar fotos gratuitas</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            search(1);
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: café, escritório, mulher sorrindo, natureza…"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading || query.trim().length < 2}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ink px-4 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {loading && page === 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Buscar
          </button>
        </form>

        {error && <p className="mt-3 rounded-lg bg-orange-50 px-3 py-2 text-[13px] text-danger">{error}</p>}

        <div className="mt-4 min-h-[120px] flex-1 overflow-y-auto">
          {photos.length === 0 && !loading && !error && (
            <p className="py-10 text-center text-[13px] text-ink-faint">Busque em português ou inglês, por exemplo: café, escritório, mulher sorrindo.</p>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => pick(photo)}
                disabled={picking !== null}
                title={`${photo.alt} — ${photo.photographer}`}
                className="group relative aspect-[4/5] overflow-hidden rounded-lg bg-canvas disabled:opacity-60"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.thumb} alt={photo.alt} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-left text-[10.5px] text-white">
                  {photo.photographer}
                </span>
                {picking === photo.id && (
                  <span className="absolute inset-0 grid place-items-center bg-black/40">
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              onClick={() => search(page + 1)}
              disabled={loading}
              className="mx-auto mt-4 flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-[13px] text-ink-soft hover:text-ink"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Carregar mais
            </button>
          )}
        </div>
        <p className="mt-3 text-[11px] text-ink-faint">
          Fotos fornecidas pelo{" "}
          <a href="https://pixabay.com" target="_blank" rel="noreferrer" className="underline">
            Pixabay
          </a>
          , gratuitas para uso comercial.
        </p>
      </div>
    </div>
  );
}
