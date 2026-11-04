"use client";

// Gerar imagem com IA (Gemini) para o slide: descrição, rosto do cliente (fotos do Instagram,
// foto de perfil do kit ou upload) e, se quiser, a imagem atual como base de estilo.

import { useRef, useState } from "react";
import { ImagePlus, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { imageFileToDataUrl } from "@/lib/client/image";
import type { PostCanvasSizeId } from "@/lib/formats";
import { ClientPhotoGrid, useClientPhotos } from "./ClientPhotos";
import { inputClass } from "./ui";

const MAX_FACES = 3;

export interface ImageAiContext {
  size: PostCanvasSizeId;
  clienteSlug: string | null;
  clienteNome: string | null;
  palette: string[];
  currentImage: string | null;
}

async function toDataUrl(blob: Blob, maxSide: number) {
  return imageFileToDataUrl(new File([blob], "imagem", { type: blob.type || "image/jpeg" }), { maxSide, quality: 0.9 });
}

export function ImageAiDialog({
  context,
  onUse,
  onClose,
}: {
  context: ImageAiContext;
  onUse: (dataUrl: string, info: string) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [useFace, setUseFace] = useState(Boolean(context.clienteSlug));
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [uploads, setUploads] = useState<string[]>([]);
  const [useCurrent, setUseCurrent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ image: string; info: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { photos, loading, error: photosError } = useClientPhotos(useFace ? context.clienteSlug : null);

  const faceCount = selected.size + uploads.length;
  const toggle = (index: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else if (faceCount < MAX_FACES) next.add(index);
      return next;
    });

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const faces = useFace
        ? [...(await Promise.all([...selected].map((i) => toDataUrl(photos[i].blob, 1024)))), ...uploads]
        : [];
      const response = await fetch("/api/estudio/imagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          size: context.size,
          clienteSlug: context.clienteSlug,
          rostos: faces,
          referencias: useCurrent && context.currentImage ? [context.currentImage] : [],
          paleta: context.palette,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Erro ao gerar a imagem.");
      // A resposta vem em PNG grande: reduz para JPEG no tamanho do slide antes de usar.
      const blob = await (await fetch(data.imagem)).blob();
      const image = await toDataUrl(blob, 1600);
      const cost = `US$ ${Number(data.custo_usd).toFixed(3).replace(".", ",")}`;
      setResult({ image, info: `Imagem gerada (${cost}; no mês: US$ ${String(data.gasto_mes_usd).replace(".", ",")} de ${data.limite_usd}).` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar a imagem.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Gerar imagem com IA">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[16px] font-bold">
            <Sparkles className="h-5 w-5 text-accent" /> Gerar imagem com IA
          </h2>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar" className="rounded-md p-1 text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.image} alt="Imagem gerada" className="mx-auto max-h-[55vh] rounded-xl border border-line" />
            <p className="text-center text-[12.5px] text-ink-soft">{result.info}</p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-[13px] text-ink-soft hover:text-ink"
              >
                <RefreshCw className="h-4 w-4" /> Ajustar e gerar de novo
              </button>
              <button
                type="button"
                onClick={() => onUse(result.image, result.info)}
                className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent/90"
              >
                Usar no slide
              </button>
            </div>
          </div>
        ) : (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[12.5px] font-medium text-ink-soft">O que aparece na imagem</span>
              <textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Ex.: a cliente sorrindo, trabalhando num notebook numa mesa de madeira, luz natural de janela, tons quentes, clima de escritório aconchegante."
                className={`${inputClass} resize-y`}
              />
            </label>

            <div className="space-y-2 rounded-xl border border-line p-3">
              <label className="flex items-center gap-2 text-[13px] font-medium">
                <input type="checkbox" checked={useFace} onChange={(e) => setUseFace(e.target.checked)} className="h-4 w-4 accent-accent" />
                Usar o rosto do cliente
                {context.clienteNome && <span className="text-ink-faint">({context.clienteNome})</span>}
              </label>
              {useFace && (
                <div className="space-y-2">
                  <p className="text-[12px] text-ink-faint">
                    Escolha até {MAX_FACES} fotos em que o rosto apareça bem (de frente, com boa luz). Quanto melhores as fotos, mais parecido fica.
                  </p>
                  {context.clienteSlug ? (
                    <ClientPhotoGrid photos={photos} loading={loading} error={photosError} selected={selected} onToggle={toggle} />
                  ) : (
                    <p className="text-[12.5px] text-ink-soft">Escolha o cliente no painel &quot;Cliente&quot; para ver as fotos do Instagram dele, ou envie uma foto.</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {uploads.map((src, i) => (
                      <span key={i} className="relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                        <button
                          type="button"
                          onClick={() => setUploads((u) => u.filter((_, j) => j !== i))}
                          aria-label="Remover foto"
                          className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <button
                      type="button"
                      disabled={faceCount >= MAX_FACES}
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[12.5px] text-ink-soft hover:text-ink disabled:opacity-50"
                    >
                      <ImagePlus className="h-4 w-4" /> Enviar foto do Drive ou do computador
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        try {
                          const src = await imageFileToDataUrl(file, { maxSide: 1024, quality: 0.9 });
                          setUploads((u) => [...u, src].slice(0, MAX_FACES));
                        } catch {
                          setError("Não foi possível ler essa foto.");
                        }
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {context.currentImage && (
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" checked={useCurrent} onChange={(e) => setUseCurrent(e.target.checked)} className="h-4 w-4 accent-accent" />
                Usar a imagem atual do slide como referência de estilo
              </label>
            )}

            {error && <p className="rounded-lg bg-orange-50 px-3 py-2 text-[13px] text-danger">{error}</p>}

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11.5px] text-ink-faint">Sem texto na imagem: o título entra pelo layout. Não gera outras pessoas reais.</p>
              <button
                type="button"
                onClick={generate}
                disabled={busy || prompt.trim().length < 5 || (useFace && faceCount === 0)}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {busy ? "Gerando… (até 1 minuto)" : "Gerar imagem"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
