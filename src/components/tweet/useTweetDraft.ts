"use client";

import { usePersistentState } from "@/components/editor/usePersistentState";
import type { TweetProfile, TweetStyle } from "@/lib/templates/tweet";

export interface EditorSlide {
  id: string;
  label: string;
  text: string;
  image: string | null;
}

export interface TweetDraft {
  profile: TweetProfile;
  style: TweetStyle;
  slides: EditorSlide[];
  caption: string;
}

const STORAGE_KEY = "designplat:tweet-draft:v1";

export function newSlide(label: string, text = ""): EditorSlide {
  return { id: crypto.randomUUID(), label, text, image: null };
}

function initialDraft(): TweetDraft {
  return {
    profile: { name: "Seu Nome", handle: "seuusuario", avatar: null, verified: true },
    style: { theme: "light", size: "portrait-3x4" },
    slides: [
      newSlide("Hook", "Enquanto você estuda a teoria,\nseu concorrente está **aplicando**."),
      newSlide("Argumento", "O erro mais comum é achar que precisa estar pronto para começar.\n\nVocê aprende **fazendo**."),
      newSlide("CTA", "Salva este post e manda para alguém que ainda está esperando o momento certo."),
    ],
    caption: "",
  };
}

function isDraft(value: unknown): value is TweetDraft {
  const draft = value as TweetDraft | null;
  return Array.isArray(draft?.slides) && draft.slides.length > 0 && Boolean(draft.profile && draft.style);
}

/** Rascunho do carrossel, salvo no navegador para não se perder ao recarregar. */
export function useTweetDraft() {
  const [draft, setDraft] = usePersistentState(STORAGE_KEY, initialDraft, isDraft);
  return { draft, setDraft, reset: () => setDraft(initialDraft()) };
}
