"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Search, Trash2 } from "lucide-react";
import { PhotoSearch } from "@/components/editor/PhotoSearch";
import { Field, IconButton, ImagePicker, inputClass } from "@/components/editor/ui";
import { FEED_LAYOUT_LABELS, FEED_LAYOUTS, type FeedLayout } from "@/lib/templates/feed";
import { ICON_IDS, ICONS } from "@/lib/templates/icons";
import type { FeedEditorSlide } from "./useFeedDraft";

interface LayoutFields {
  title: string;
  body: string | null;
  bodyRows?: number;
  hint?: string;
  image?: string;
  icon?: boolean;
}

const FIELDS: Record<FeedLayout, LayoutFields> = {
  destaque: { title: "Título", body: "Subtítulo (opcional)", image: "Imagem de fundo (opcional)", icon: true },
  texto: { title: "Título", body: "Texto", bodyRows: 7, icon: true },
  lista: { title: "Título", body: "Itens (um por linha)", bodyRows: 7, hint: "Cada linha vira um item numerado.", icon: true },
  numero: { title: "Número em destaque", body: "O que esse número significa", hint: "Ex.: +37%, 10 mil, 3x, R$ 99.", icon: true },
  citacao: { title: "Frase", body: "Autor (opcional)" },
  comparacao: {
    title: "Título (opcional)",
    body: "Antes e depois",
    bodyRows: 9,
    hint: "Escreva duas colunas separadas por uma linha em branco. A primeira linha de cada coluna é o rótulo (ex.: Antes / Depois) e as seguintes são os itens.",
  },
  foto: { title: "Título", body: "Texto (opcional)", image: "Foto" },
  celular: { title: "Título", body: "Texto (opcional)", image: "Imagem na tela do celular", icon: true, hint: "Ótimo para mostrar um app, site ou print." },
  referencia: { title: "Título", body: "Texto (opcional)", image: "Imagem (opcional)", icon: true },
};

export function SlideFields({
  slide,
  index,
  total,
  hasCustomLayout,
  onChange,
  onMove,
  onRemove,
  onError,
  onInfo,
}: {
  slide: FeedEditorSlide;
  index: number;
  total: number;
  hasCustomLayout: boolean;
  onChange: (patch: Partial<FeedEditorSlide>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
}) {
  const [searching, setSearching] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const fields = FIELDS[slide.layout];
  const layouts = FEED_LAYOUTS.filter((layout) => layout !== "referencia" || hasCustomLayout || slide.layout === "referencia");

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[12px] font-bold text-white">{index + 1}</span>
        <span className="flex-1 text-[13px] font-semibold">Layout do slide</span>
        <IconButton label="Mover para a esquerda" onClick={() => onMove(-1)} disabled={index === 0} icon={ArrowLeft} />
        <IconButton label="Mover para a direita" onClick={() => onMove(1)} disabled={index === total - 1} icon={ArrowRight} />
        <IconButton label="Excluir slide" onClick={onRemove} disabled={total === 1} icon={Trash2} danger />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {layouts.map((layout) => (
          <button
            key={layout}
            type="button"
            onClick={() => onChange({ layout })}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              slide.layout === layout ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:border-line-strong hover:text-ink"
            }`}
          >
            {FEED_LAYOUT_LABELS[layout]}
          </button>
        ))}
      </div>
      {slide.layout === "referencia" && !hasCustomLayout && (
        <p className="rounded-lg bg-orange-50 px-3 py-2 text-[12.5px] text-danger">
          Nenhum layout de referência criado ainda; este slide está usando o layout Texto.
        </p>
      )}

      <Field label={fields.title}>
        <textarea
          value={slide.title}
          onChange={(e) => onChange({ title: e.target.value })}
          rows={slide.layout === "numero" ? 1 : 3}
          className={`${inputClass} resize-y text-[14.5px] leading-relaxed`}
        />
      </Field>
      {fields.body && (
        <Field label={fields.body}>
          <textarea
            value={slide.body}
            onChange={(e) => onChange({ body: e.target.value })}
            rows={fields.bodyRows ?? 3}
            className={`${inputClass} resize-y text-[14.5px] leading-relaxed`}
          />
        </Field>
      )}
      {fields.hint && <p className="-mt-2 text-[12px] text-ink-faint">{fields.hint}</p>}

      {fields.image && (
        <div className="flex flex-wrap items-center gap-2">
          <ImagePicker value={slide.image} onChange={(image) => onChange({ image })} onError={onError} label={fields.image} maxSide={1600} />
          {!slide.image && (
            <button
              type="button"
              onClick={() => setSearching(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[12.5px] text-ink-soft hover:text-ink"
            >
              <Search className="h-4 w-4" /> Buscar fotos grátis
            </button>
          )}
        </div>
      )}

      {fields.icon && (
        <div>
          <button
            type="button"
            onClick={() => setShowIcons((open) => !open)}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12.5px] text-ink-soft hover:text-ink"
          >
            {slide.icon && slide.icon in ICONS ? (
              <span className="h-4 w-4 [&>svg]:h-4 [&>svg]:w-4" dangerouslySetInnerHTML={{ __html: ICONS[slide.icon as keyof typeof ICONS].svg }} />
            ) : null}
            {slide.icon && slide.icon in ICONS ? `Ícone: ${ICONS[slide.icon as keyof typeof ICONS].label}` : "Adicionar ícone (opcional)"}
          </button>
          {showIcons && (
            <div className="mt-2 grid grid-cols-6 gap-1.5 rounded-xl border border-line p-2 sm:grid-cols-8">
              <button
                type="button"
                onClick={() => {
                  onChange({ icon: null });
                  setShowIcons(false);
                }}
                className="col-span-2 rounded-lg border border-line px-2 py-2 text-[12px] text-ink-soft hover:text-ink"
              >
                Nenhum
              </button>
              {ICON_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  title={ICONS[id].label}
                  aria-label={ICONS[id].label}
                  onClick={() => {
                    onChange({ icon: id });
                    setShowIcons(false);
                  }}
                  className={`grid h-10 place-items-center rounded-lg border [&>svg]:h-5 [&>svg]:w-5 ${
                    slide.icon === id ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-soft hover:text-ink"
                  }`}
                  dangerouslySetInnerHTML={{ __html: ICONS[id].svg }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[12px] text-ink-faint">Dica: **palavra** fica em negrito, na cor de destaque.</p>

      {searching && (
        <PhotoSearch
          onClose={() => setSearching(false)}
          onPick={(image, credit) => {
            onChange({ image });
            setSearching(false);
            onInfo(`Foto aplicada. ${credit}`);
          }}
        />
      )}
    </div>
  );
}
