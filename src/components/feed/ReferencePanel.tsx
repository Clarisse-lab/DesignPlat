"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Palette, Sparkles, X } from "lucide-react";
import { Panel } from "@/components/editor/ui";
import { imageFileToDataUrl, loadImageForAnalysis } from "@/lib/client/image";
import { inferLayout, type InferredLayout } from "@/lib/reference/layout";
import { readTextLines } from "@/lib/reference/ocr";
import { extractPalette, type ExtractedPalette } from "@/lib/reference/palette";
import { FEED_LAYOUT_LABELS, type CustomLayout, type FeedStyle } from "@/lib/templates/feed";

export interface AiReferenceResult {
  name: string;
  style: Pick<FeedStyle, "palette" | "titleFont" | "align" | "verticalAlign" | "decor">;
  customLayout: CustomLayout;
  icon: string | null;
}

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
  onAiStyle,
  onRemoveCustomLayout,
  onError,
}: {
  size: FeedStyle["size"];
  customLayout: CustomLayout | null;
  onInspire: (result: { palette: ExtractedPalette; layout: InferredLayout | null }) => void;
  onAiStyle: (result: AiReferenceResult) => void;
  onRemoveCustomLayout: () => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<"inspire" | "ai" | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // A URL do arquivo só existe depois de escolhido; é liberada ao trocar de imagem.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const inspire = async () => {
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
    if (!file) return;
    setBusy("ai");
    setStatus("A IA está estudando a referência (pode levar até 1 minuto)");
    try {
      const image = await imageFileToDataUrl(file, { maxSide: 1568, quality: 0.9 });
      const response = await fetch("/api/feed/reference-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, size }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof data?.error === "string" ? data.error : "Erro ao copiar o estilo.");
      onAiStyle(data as AiReferenceResult);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erro ao copiar o estilo.");
    } finally {
      setBusy(null);
      setStatus("");
    }
  };

  return (
    <Panel title="Imagem de referência">
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const picked = e.target.files?.[0];
            if (picked) setFile(picked);
            e.target.value = "";
          }}
        />
        {file && previewUrl ? (
          <div className="flex items-center gap-3 rounded-xl border border-line p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Referência" className="h-16 w-14 rounded-md object-cover" />
            <span className="flex-1 truncate text-[12.5px] text-ink-soft">{file.name}</span>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreviewUrl(null);
              }}
              disabled={busy !== null}
              aria-label="Remover referência"
              className="rounded-md p-1 text-ink-faint hover:text-danger"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-3 py-5 text-[12.5px] text-ink-soft hover:text-ink"
          >
            <ImagePlus className="h-5 w-5" />
            Enviar um post que você quer usar de inspiração
          </button>
        )}

        <div className="grid gap-2">
          <button
            type="button"
            onClick={inspire}
            disabled={!file || busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-line-strong disabled:opacity-50"
          >
            {busy === "inspire" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Palette className="h-4 w-4" />}
            Inspirar (cores e posição) · grátis
          </button>
          <button
            type="button"
            onClick={copyWithAi}
            disabled={!file || busy !== null}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {busy === "ai" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Copiar estilo com IA
          </button>
        </div>
        {status && <p className="text-[12px] text-ink-soft">{status}</p>}
        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          <strong>Inspirar</strong> copia as cores e a posição dos textos e escolhe o layout mais parecido. <strong>Copiar com IA</strong>{" "}
          recria a composição inteira (formas, fonte, blocos) como um layout novo; custa centavos por análise e precisa da chave da Anthropic.
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
