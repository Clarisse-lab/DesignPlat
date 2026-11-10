"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Images, Search, Sparkles, Trash2 } from "lucide-react";
import { ClientPhotosDialog } from "@/components/editor/ClientPhotos";
import { ImageAiDialog, type ImageAiContext } from "@/components/editor/ImageAiDialog";
import { textZoneOfFree } from "@/lib/ai/image-direction";
import { imageFileToDataUrl } from "@/lib/client/image";
import { PhotoSearch } from "@/components/editor/PhotoSearch";
import { Field, IconButton, ImagePicker, inputClass } from "@/components/editor/ui";
import { FEED_LAYOUT_LABELS, type FeedLayout } from "@/lib/templates/feed";
import { ICON_IDS, ICONS } from "@/lib/templates/icons";
import { EMPTY_FREE, FreeEditor, type PreviewContext } from "./FreeEditor";
import type { FeedEditorSlide } from "./useFeedDraft";
import { buildPreset } from "@/lib/templates/free";

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
  sticker: {
    title: "Pergunta ou chamada",
    body: "Texto de apoio (opcional)",
    icon: true,
    hint: "A parte de baixo fica livre para você colar a enquete, a caixinha de perguntas ou o link no próprio Instagram (a área aparece tracejada no preview).",
  },
  cta: { title: "Chamada", body: "Texto do botão", icon: true, hint: "Se deixar o texto do botão vazio, aparece \"Toque no link\"." },
  secao: { title: "Nome da seção", body: "Subtítulo (opcional)", icon: true, hint: "O número da seção (01, 02…) é contado automaticamente." },
  colunas: {
    title: "Título (opcional)",
    body: "Colunas",
    bodyRows: 9,
    icon: true,
    hint: "Até 4 colunas, separadas por uma linha em branco. A primeira linha de cada coluna é o título dela e as seguintes, o texto.",
  },
  referencia: { title: "Título", body: "Texto (opcional)", image: "Imagem (opcional)", icon: true },
  livre: { title: "", body: null, image: "Foto de fundo" },
};

export function SlideFields({
  slide,
  index,
  total,
  availableLayouts,
  hasCustomLayout,
  showNotes = false,
  onChange,
  onMove,
  onRemove,
  onError,
  onInfo,
  imageAi = null,
  selectedElement = null,
  onSelectElement = () => {},
  onSpread = () => {},
  preview,
}: {
  slide: FeedEditorSlide;
  index: number;
  total: number;
  availableLayouts: readonly FeedLayout[];
  hasCustomLayout: boolean;
  /** Mostra o campo de notas do apresentador (Apresentação). */
  showNotes?: boolean;
  onChange: (patch: Partial<FeedEditorSlide>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
  /** Contexto para gerar imagem com IA e usar fotos do cliente (null: login desligado). */
  imageAi?: Omit<ImageAiContext, "currentImage"> | null;
  /** Elemento selecionado no layout Livre (compartilhado com as alças da prévia). */
  selectedElement?: string | null;
  onSelectElement?: (id: string | null) => void;
  /** Carrossel infinito (layout Livre): espalha a foto de fundo por N slides a partir deste. */
  onSpread?: (total: number) => void;
  /** Marca, cores e fonte da peça (miniaturas dos modelos do Livre). */
  preview: PreviewContext;
}) {
  const [searching, setSearching] = useState(false);
  const [showIcons, setShowIcons] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clientPhotos, setClientPhotos] = useState(false);
  const fields = FIELDS[slide.layout];
  const layouts = availableLayouts.filter((layout) => layout !== "referencia" || hasCustomLayout || slide.layout === "referencia");

  const imageBlock = (
    <div className="flex flex-wrap items-center gap-2">
          <ImagePicker value={slide.image} onChange={(image) => onChange({ image })} onError={onError} label={fields.image ?? "Imagem"} maxSide={slide.layout === "livre" ? 3200 : 1600} />
          {!slide.image && (
            <button
              type="button"
              onClick={() => setSearching(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[12.5px] text-ink-soft hover:text-ink"
            >
              <Search className="h-4 w-4" /> Buscar fotos grátis
            </button>
          )}
          {imageAi && (
            <button
              type="button"
              onClick={() => setGenerating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-[12.5px] font-medium text-accent hover:border-accent"
            >
              <Sparkles className="h-4 w-4" /> {slide.image ? "Gerar outra com IA" : "Gerar com IA"}
            </button>
          )}
          {imageAi?.clienteSlug && (
            <button
              type="button"
              onClick={() => setClientPhotos(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] text-ink-soft hover:text-ink"
            >
              <Images className="h-4 w-4" /> Fotos do cliente
            </button>
          )}
        </div>
  );

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-[12px] font-bold text-white">{index + 1}</span>
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[13px] font-semibold">Layout</span>
          <select
            value={slide.layout}
            onChange={(e) => {
              const layout = e.target.value as FeedLayout;
              if (layout === "livre" && !slide.free) {
                // Primeira vez no Livre: começa por um modelo com o texto e a foto que o slide já tem.
                const hasText = Boolean(slide.title.trim() || slide.body.trim());
                const free = buildPreset(index === 0 ? "capa-revista" : "interno-texto", { title: slide.title, body: slide.body, hasImage: Boolean(slide.image) }, { placeholders: !hasText });
                onChange({ layout, free });
              } else onChange({ layout });
            }}
            className={`${inputClass} min-w-0 flex-1`}
          >
            {layouts.includes("livre") && <option value="livre">{FEED_LAYOUT_LABELS.livre} · elementos livres</option>}
            {layouts
              .filter((layout) => layout !== "livre")
              .map((layout) => (
                <option key={layout} value={layout}>
                  {FEED_LAYOUT_LABELS[layout]}
                </option>
              ))}
          </select>
        </label>
        <IconButton label="Mover para a esquerda" onClick={() => onMove(-1)} disabled={index === 0} icon={ArrowLeft} />
        <IconButton label="Mover para a direita" onClick={() => onMove(1)} disabled={index === total - 1} icon={ArrowRight} />
        <IconButton label="Excluir slide" onClick={onRemove} disabled={total === 1} icon={Trash2} danger />
      </div>

      {slide.layout === "referencia" && !hasCustomLayout && (
        <p className="rounded-lg bg-orange-50 px-3 py-2 text-[12.5px] text-danger">
          Nenhum layout de referência criado ainda; este slide está usando o layout Texto.
        </p>
      )}

      {slide.layout === "livre" ? (
        <FreeEditor
          free={slide.free ?? EMPTY_FREE}
          title={slide.title}
          body={slide.body}
          hasImage={Boolean(slide.image)}
          selectedId={selectedElement}
          onSelect={onSelectElement}
          onChange={(free) => onChange({ free })}
          onError={onError}
          imageControls={imageBlock}
          imageAi={imageAi}
          image={slide.image ?? null}
          onImage={(image) => onChange({ image })}
          onSpread={onSpread}
          preview={preview}
        />
      ) : (
        <>
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

          {fields.image && imageBlock}
        </>
      )}

      {fields.icon && slide.layout !== "livre" && (
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

      {showNotes && (
        <Field label="Notas do apresentador (opcional)">
          <textarea
            value={slide.notes ?? ""}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={3}
            maxLength={3000}
            placeholder="O que falar neste slide. Não aparece no slide; vai para as anotações do PowerPoint."
            className={`${inputClass} resize-y`}
          />
        </Field>
      )}

      {slide.layout !== "livre" && <p className="text-[12px] text-ink-faint">Dica: **palavra** fica em negrito, na cor de destaque.</p>}

      {generating && imageAi && (
        <ImageAiDialog
          context={{ ...imageAi, currentImage: slide.image ?? null, textZone: slide.layout === "livre" ? textZoneOfFree(slide.free) : undefined }}
          onClose={() => setGenerating(false)}
          onUse={(image, info) => {
            onChange({ image });
            setGenerating(false);
            onInfo(info);
          }}
        />
      )}
      {clientPhotos && imageAi?.clienteSlug && (
        <ClientPhotosDialog
          slug={imageAi.clienteSlug}
          onClose={() => setClientPhotos(false)}
          onPick={async (blob) => {
            try {
              const image = await imageFileToDataUrl(new File([blob], "foto", { type: blob.type || "image/jpeg" }), { maxSide: 1600 });
              onChange({ image });
              setClientPhotos(false);
              onInfo("Foto do cliente aplicada.");
            } catch {
              onError("Não foi possível usar essa foto.");
            }
          }}
        />
      )}
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
