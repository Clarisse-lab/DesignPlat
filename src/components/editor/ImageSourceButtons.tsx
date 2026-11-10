"use client";

// Fontes de imagem para um espaço do slide (elemento Imagem, cada foto das Tiras / grade):
// enviar do computador, fotos do Instagram do cliente ou gerar com IA.

import { useRef, useState } from "react";
import { Images, ImagePlus, Sparkles, X } from "lucide-react";
import { imageFileToDataUrl } from "@/lib/client/image";
import { ClientPhotosDialog } from "./ClientPhotos";
import { ImageAiDialog, type ImageAiContext } from "./ImageAiDialog";

export type ImageAiBase = Omit<ImageAiContext, "currentImage">;

const btn = "inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[12px]";

export function ImageSourceButtons({
  value,
  onChange,
  onError,
  imageAi,
  label,
}: {
  value: string | null | undefined;
  onChange: (dataUrl: string | null) => void;
  onError: (message: string) => void;
  imageAi: ImageAiBase | null;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dialog, setDialog] = useState<"ia" | "cliente" | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {label && <span className="w-full text-[12px] text-ink-soft">{label}</span>}
      {value && (
        <span className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-12 w-12 rounded-md object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remover imagem"
            className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-ink text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      )}
      <button type="button" onClick={() => fileRef.current?.click()} className={`${btn} border-dashed border-line-strong text-ink-soft hover:text-ink`}>
        <ImagePlus className="h-3.5 w-3.5" /> Enviar
      </button>
      {imageAi?.clienteSlug && (
        <button type="button" onClick={() => setDialog("cliente")} className={`${btn} border-line text-ink-soft hover:text-ink`}>
          <Images className="h-3.5 w-3.5" /> Do cliente
        </button>
      )}
      {imageAi && (
        <button type="button" onClick={() => setDialog("ia")} className={`${btn} border-accent/40 bg-accent-soft font-medium text-accent hover:border-accent`}>
          <Sparkles className="h-3.5 w-3.5" /> IA
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            onChange(await imageFileToDataUrl(file, { maxSide: 1600 }));
          } catch {
            onError("Não foi possível ler essa imagem.");
          }
        }}
      />
      {dialog === "ia" && imageAi && (
        <ImageAiDialog
          // Imagem de elemento (foto, tira, grade): o texto fica fora dela.
          context={{ ...imageAi, currentImage: value ?? null, textZone: "nenhuma" }}
          onClose={() => setDialog(null)}
          onUse={(image) => {
            onChange(image);
            setDialog(null);
          }}
        />
      )}
      {dialog === "cliente" && imageAi?.clienteSlug && (
        <ClientPhotosDialog
          slug={imageAi.clienteSlug}
          onClose={() => setDialog(null)}
          onPick={async (blob) => {
            try {
              onChange(await imageFileToDataUrl(new File([blob], "foto", { type: blob.type || "image/jpeg" }), { maxSide: 1600 }));
              setDialog(null);
            } catch {
              onError("Não foi possível usar essa foto.");
            }
          }}
        />
      )}
    </div>
  );
}
