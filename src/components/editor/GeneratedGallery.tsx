"use client";

// Galeria das imagens já geradas com IA (guardadas em design_imagens). Usar uma daqui não gasta nada.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchGeneratedImage, listGeneratedImages, type GeneratedImageSummary } from "@/lib/client/generated-images";

const PAGE = 24;
const WIDE = new Set(["16:9", "21:9"]);

const whenBR = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function GeneratedGallery({
  clienteSlug,
  clienteNome,
  aspect,
  onPick,
}: {
  clienteSlug: string | null;
  clienteNome: string | null;
  /** Panorama: mostra só as imagens largas; senão, esconde as largas. */
  aspect?: string;
  onPick: (image: Blob, info: { zona: string | null; prompt: string }) => Promise<void> | void;
}) {
  const [onlyClient, setOnlyClient] = useState(Boolean(clienteSlug));
  const [items, setItems] = useState<GeneratedImageSummary[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(null);
    setError(null);
    listGeneratedImages({ cliente: onlyClient ? clienteSlug : null, limite: PAGE })
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        setMore(list.length === PAGE);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Erro ao listar."));
    return () => {
      cancelled = true;
    };
  }, [onlyClient, clienteSlug]);

  const loadMore = async () => {
    if (!items?.length) return;
    setLoadingMore(true);
    try {
      const list = await listGeneratedImages({ cliente: onlyClient ? clienteSlug : null, antes: items[items.length - 1].criado_em, limite: PAGE });
      setItems((current) => [...(current ?? []), ...list]);
      setMore(list.length === PAGE);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao listar.");
    } finally {
      setLoadingMore(false);
    }
  };

  const pick = async (item: GeneratedImageSummary) => {
    setOpening(item.id);
    setError(null);
    try {
      const data = await fetchGeneratedImage(item.id);
      const blob = await (await fetch(data.imagem)).blob();
      await onPick(blob, { zona: data.zona, prompt: data.prompt });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao abrir a imagem.");
    } finally {
      setOpening(null);
    }
  };

  const visible = (items ?? []).filter((i) => (aspect ? i.proporcao === aspect : !WIDE.has(i.proporcao ?? "")));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-ink-soft">Toda imagem gerada fica guardada aqui, mesmo as que não foram usadas. Reaproveitar não gasta nada.</p>
        {clienteSlug && (
          <label className="flex items-center gap-2 text-[12.5px] text-ink-soft">
            <input type="checkbox" checked={onlyClient} onChange={(e) => setOnlyClient(e.target.checked)} className="h-4 w-4 accent-accent" />
            Só de {clienteNome ?? "este cliente"}
          </label>
        )}
      </div>

      {error && <p className="rounded-lg bg-orange-50 px-3 py-2 text-[13px] text-danger">{error}</p>}

      {items === null ? (
        <p className="flex items-center gap-2 py-6 text-[13px] text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </p>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-ink-soft">Nenhuma imagem gerada {onlyClient && clienteNome ? `para ${clienteNome} ` : ""}ainda.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={Boolean(opening)}
              onClick={() => pick(item)}
              title={item.prompt}
              className="group relative overflow-hidden rounded-lg border border-line text-left hover:border-accent disabled:opacity-60"
            >
              {item.miniatura ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.miniatura} alt={item.prompt} loading="lazy" className="aspect-[4/5] w-full object-cover" />
              ) : (
                <span className="flex aspect-[4/5] w-full items-center justify-center bg-canvas text-[11px] text-ink-faint">sem prévia</span>
              )}
              <span className="block truncate px-1.5 py-1 text-[10.5px] text-ink-faint">
                {whenBR(item.criado_em)}
                {item.criado_por ? ` · ${item.criado_por.split(" ")[0]}` : ""}
              </span>
              {opening === item.id && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {more && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] text-ink-soft hover:text-ink disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Carregar mais
          </button>
        </div>
      )}
    </div>
  );
}
