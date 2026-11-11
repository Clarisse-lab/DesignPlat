"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Palette, Sparkles, X } from "lucide-react";
import { Panel } from "@/components/editor/ui";
import { imageFileToDataUrl, loadImageForAnalysis } from "@/lib/client/image";
import { inferLayout, type InferredLayout } from "@/lib/reference/layout";
import { readTextLines } from "@/lib/reference/ocr";
import { extractPalette, type ExtractedPalette } from "@/lib/reference/palette";
import { FEED_LAYOUT_LABELS, type CustomLayout, type FeedStyle } from "@/lib/templates/feed";
import type { FreeSlide } from "@/lib/templates/free";

/** Resposta de /api/feed/reference-layouts: telas Livre copiadas da referência. */
export interface AiReferenceLayouts {
  name: string;
  palette: FeedStyle["palette"];
  titleFont: FeedStyle["titleFont"];
  layouts: { capa: FreeSlide | null; internos: FreeSlide[]; final: FreeSlide | null };
}

type Role = "capa" | "interno" | "final";
const ROLES: { id: Role; label: string; hint: string }[] = [
  { id: "capa", label: "Capa", hint: "1ª tela" },
  { id: "interno", label: "Tela interna", hint: "uma do meio" },
  { id: "final", label: "Fechamento", hint: "última tela" },
];

const OCR_STATUS: Record<string, string> = {
  "loading tesseract core": "Baixando o leitor de texto",
  "initializing tesseract": "Preparando o leitor de texto",
  "loading language traineddata": "Baixando o idioma português",
  "initializing api": "Preparando o leitor de texto",
  "recognizing text": "Lendo os textos da imagem",
};

export function ReferencePanel({
  size,
  customLayout,
  onInspire,
  onAiLayouts,
  onRemoveCustomLayout,
  onError,
}: {
  size: FeedStyle["size"];
  customLayout: CustomLayout | null;
  onInspire: (result: { palette: ExtractedPalette; layout: InferredLayout | null }) => void;
  onAiLayouts: (result: AiReferenceLayouts) => void;
  onRemoveCustomLayout: () => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<Role>("capa");
  const [files, setFiles] = useState<Partial<Record<Role, File>>>({});
  const [previews, setPreviews] = useState<Partial<Record<Role, string>>>({});
  const [busy, setBusy] = useState<"inspire" | "ai" | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const urls: Partial<Record<Role, string>> = {};
    for (const role of Object.keys(files) as Role[]) {
      const f = files[role];
      if (f) urls[role] = URL.createObjectURL(f);
    }
    // As URLs dos arquivos só existem depois de escolhidos; são liberadas ao trocar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviews(urls);
    return () => Object.values(urls).forEach((u) => u && URL.revokeObjectURL(u));
  }, [files]);

  const chosen = ROLES.filter((r) => files[r.id]);
  const first = chosen[0] ? files[chosen[0].id] : undefined;

  const inspire = async () => {
    const file = files.capa ?? first;
    if (!file) return;
    setBusy("inspire");
    setStatus("Analisando as cores");
    try {
      const small = await loadImageForAnalysis(file, 220);
      const palette = extractPalette(small.pixels, small.width, small.height);
      const big = await loadImageForAnalysis(file, 1600);
      const lines = await readTextLines(big.canvas, (raw, progress) => {
        const label = OCR_STATUS[raw];
        if (label) setStatus(`${label}… ${Math.round(progress * 100)}%`);
      });
      onInspire({ palette, layout: inferLayout(lines, big.width, big.height) });
    } catch (error) {
      console.error(error);
      onError("Não foi possível analisar a imagem. Tente outra referência.");
    } finally {
      setBusy(null);
      setStatus("");
    }
  };

  const copyWithAi = async () => {
    if (!chosen.length) return;
    setBusy("ai");
    setStatus(`A IA está estudando ${chosen.length > 1 ? `as ${chosen.length} telas` : "a referência"} (pode levar até 2 minutos)`);
    try {
      const images = await Promise.all(
        chosen.map(async (r) => ({ role: r.id, image: await imageFileToDataUrl(files[r.id]!, { maxSide: 1568, quality: 0.9 }) })),
      );
      const response = await fetch("/api/feed/reference-layouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, size }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Erro ao copiar o estilo.");
      onAiLayouts(data as AiReferenceLayouts);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erro ao copiar o estilo.");
    } finally {
      setBusy(null);
      setStatus("");
    }
  };

  return (
    <Panel title="Telas de referência">
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) setFiles((f) => ({ ...f, [target]: picked }));
            e.target.value = "";
          }}
        />
        <div className="grid grid-cols-3 gap-2">
          {ROLES.map((r) => {
            const url = previews[r.id];
            return (
              <div key={r.id} className="space-y-1 text-center">
                {url ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={r.label} className="aspect-[4/5] w-full rounded-lg border border-line object-cover" />
                    <button
                      type="button"
                      onClick={() => setFiles((f) => ({ ...f, [r.id]: undefined }))}
                      disabled={busy !== null}
                      aria-label={`Remover ${r.label}`}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTarget(r.id);
                      inputRef.current?.click();
                    }}
                    disabled={busy !== null}
                    className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong text-ink-soft hover:text-ink"
                  >
                    <ImagePlus className="h-4 w-4" />
                    <span className="text-[10.5px] leading-tight">{r.hint}</span>
                  </button>
                )}
                <span className="block text-[11.5px] font-medium text-ink-soft">{r.label}</span>
              </div>
            );
          })}
        </div>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={inspire}
            disabled={!first || busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-line-strong disabled:opacity-50"
          >
            {busy === "inspire" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />}
            Inspirar (cores e posição) · grátis
          </button>
          <button
            type="button"
            onClick={copyWithAi}
            disabled={!chosen.length || busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Copiar estilo com IA
          </button>
        </div>
        {status && <p className="text-[12px] text-ink-soft">{status}</p>}
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          Envie a capa, uma tela interna e o fechamento do carrossel de referência (pode ser só uma delas). <strong>Copiar com IA</strong> recria cada
          uma como tela Livre, que você edita à vontade e depois guarda em <strong>Mais → Salvar como estilo</strong>. Custa centavos por análise.{" "}
          <strong>Inspirar</strong> só copia as cores e a posição dos textos da capa.
        </p>

        {customLayout && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[12.5px] text-accent">
            <span className="truncate">
              {FEED_LAYOUT_LABELS.referencia}: <strong>{customLayout.name}</strong>
            </span>
            <button type="button" onClick={onRemoveCustomLayout} className="shrink-0 underline">
              remover
            </button>
          </div>
        )}
      </div>
    </Panel>
  );
}
