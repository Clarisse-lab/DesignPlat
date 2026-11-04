"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

export interface ClientPhoto {
  /** Blob URL para mostrar na tela (a imagem passa pelo proxy autenticado). */
  preview: string;
  blob: Blob;
  permalink: string | null;
}

/** Carrega a foto de perfil e as fotos recentes do Instagram do cliente (pelo proxy do servidor). */
export function useClientPhotos(slug: string | null) {
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/estudio/clientes/${encodeURIComponent(slug)}/fotos`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Erro ao buscar as fotos.");
        const list: { src: string; permalink: string | null }[] = [
          ...(data.perfil ? [{ src: data.perfil, permalink: null }] : []),
          ...data.fotos,
        ];
        const loaded = await Promise.all(
          list.map(async (item) => {
            try {
              const r = await fetch(item.src);
              if (!r.ok) return null;
              const blob = await r.blob();
              const preview = URL.createObjectURL(blob);
              urls.push(preview);
              return { preview, blob, permalink: item.permalink };
            } catch {
              return null;
            }
          }),
        );
        if (!cancelled) setPhotos(loaded.filter((p): p is ClientPhoto => p !== null));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Erro ao buscar as fotos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [slug]);

  return { photos, loading, error };
}

/** Grade de fotos do cliente para escolher uma (fundo do slide) ou várias (rosto de referência). */
export function ClientPhotoGrid({
  photos,
  loading,
  error,
  selected,
  onToggle,
}: {
  photos: ClientPhoto[];
  loading: boolean;
  error: string | null;
  selected: Set<number>;
  onToggle: (index: number) => void;
}) {
  if (loading)
    return (
      <p className="flex items-center gap-2 py-6 text-[13px] text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" /> Buscando as fotos do Instagram do cliente…
      </p>
    );
  if (error) return <p className="rounded-lg bg-orange-50 px-3 py-2 text-[13px] text-danger">{error}</p>;
  if (photos.length === 0) return <p className="py-4 text-[13px] text-ink-faint">Nenhuma foto encontrada.</p>;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {photos.map((photo, index) => (
        <button
          key={photo.preview}
          type="button"
          onClick={() => onToggle(index)}
          title={photo.permalink ? "Post do Instagram" : "Foto de perfil"}
          className={`relative aspect-[4/5] overflow-hidden rounded-lg border-2 bg-canvas ${selected.has(index) ? "border-accent" : "border-transparent"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.preview} alt="" className="h-full w-full object-cover" />
          {!photo.permalink && <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">Perfil</span>}
          {selected.has(index) && (
            <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-white">
              <Check className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Janela para usar uma foto do Instagram do cliente como imagem do slide. */
export function ClientPhotosDialog({
  slug,
  onPick,
  onClose,
}: {
  slug: string;
  onPick: (blob: Blob) => void;
  onClose: () => void;
}) {
  const { photos, loading, error } = useClientPhotos(slug);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Fotos do cliente">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 rounded-2xl bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">Fotos do cliente (Instagram)</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-[120px] overflow-y-auto">
          <ClientPhotoGrid photos={photos} loading={loading} error={error} selected={new Set()} onToggle={(i) => onPick(photos[i].blob)} />
        </div>
        <p className="text-[11.5px] text-ink-faint">Posts recentes de imagem e carrossel, priorizando os que mais salvaram e compartilharam.</p>
      </div>
    </div>
  );
}
