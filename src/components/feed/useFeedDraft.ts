"use client";

import { usePersistentState } from "@/components/editor/usePersistentState";
import { resolveFeedStyle, type FeedBrand, type FeedLayout, type FeedSlide, type FeedStyle } from "@/lib/templates/feed";

export type FeedEditorSlide = FeedSlide & { id: string };

export interface FeedDraft {
  brand: FeedBrand;
  style: FeedStyle;
  slides: FeedEditorSlide[];
}

export function newFeedSlide(slide: Partial<FeedSlide> & { layout: FeedLayout }): FeedEditorSlide {
  return { id: crypto.randomUUID(), title: "", body: "", image: null, icon: null, ...slide };
}

export function isFeedDraft(value: unknown): value is FeedDraft {
  const draft = value as FeedDraft | null;
  return Array.isArray(draft?.slides) && draft.slides.length > 0 && Boolean(draft.brand && draft.style?.palette);
}

/** Rascunho do post (Feed ou Story), salvo no navegador para não se perder ao recarregar. */
export function useFeedDraft(storageKey: string, initialDraft: () => FeedDraft) {
  const [stored, setDraft] = usePersistentState(storageKey, initialDraft, isFeedDraft);
  // Rascunhos salvos antes de novas opções existirem ganham os valores padrão.
  const draft: FeedDraft = { ...stored, style: resolveFeedStyle(stored.style) };
  return { draft, setDraft, reset: () => setDraft(initialDraft()) };
}
