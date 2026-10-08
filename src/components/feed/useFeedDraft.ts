"use client";

import { usePersistentState } from "@/components/editor/usePersistentState";
import { DEFAULT_FEED_STYLE, resolveFeedStyle, type FeedBrand, type FeedLayout, type FeedSlide, type FeedStyle } from "@/lib/templates/feed";

export type FeedEditorSlide = FeedSlide & { id: string };

export interface FeedDraft {
  brand: FeedBrand;
  style: FeedStyle;
  slides: FeedEditorSlide[];
}

const STORAGE_KEY = "designplat:feed-draft:v1";

export function newFeedSlide(slide: Partial<FeedSlide> & { layout: FeedLayout }): FeedEditorSlide {
  return { id: crypto.randomUUID(), title: "", body: "", image: null, icon: null, ...slide };
}

function initialDraft(): FeedDraft {
  return {
    brand: { name: "Sua Marca", handle: "suamarca", logo: null },
    style: DEFAULT_FEED_STYLE,
    slides: [
      newFeedSlide({ layout: "destaque", title: "3 sinais de que sua marca precisa de **consistência**", body: "Arrasta para o lado →" }),
      newFeedSlide({
        layout: "texto",
        title: "1. Cada post parece de uma empresa diferente",
        body: "Cores, fontes e tom de voz mudam toda semana. O público não **reconhece** você no feed.",
      }),
      newFeedSlide({ layout: "citacao", title: "Marca forte é a que você reconhece antes de ler o nome.", body: "Equipe Mantora" }),
    ],
  };
}

function isDraft(value: unknown): value is FeedDraft {
  const draft = value as FeedDraft | null;
  return Array.isArray(draft?.slides) && draft.slides.length > 0 && Boolean(draft.brand && draft.style?.palette);
}

/** Rascunho do post, salvo no navegador para não se perder ao recarregar. */
export function useFeedDraft() {
  const [stored, setDraft] = usePersistentState(STORAGE_KEY, initialDraft, isDraft);
  // Rascunhos salvos antes de novas opções existirem ganham os valores padrão.
  const draft: FeedDraft = { ...stored, style: resolveFeedStyle(stored.style) };
  return { draft, setDraft, reset: () => setDraft(initialDraft()) };
}
