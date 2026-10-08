"use client";

import { useEffect, useState } from "react";
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

function readStoredDraft(): TweetDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TweetDraft;
    return Array.isArray(parsed?.slides) && parsed.slides.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/** Rascunho do carrossel, salvo no navegador para não se perder ao recarregar. */
export function useTweetDraft() {
  const [draft, setDraft] = useState<TweetDraft>(initialDraft);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = readStoredDraft();
    // Restaurar do localStorage só é possível depois de montar no navegador.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setDraft(stored);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // armazenamento cheio ou bloqueado: o editor continua funcionando sem salvar
    }
  }, [draft, loaded]);

  return { draft, setDraft, reset: () => setDraft(initialDraft()) };
}
