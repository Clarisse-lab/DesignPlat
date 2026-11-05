"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "mantora:appearance:v1";
const EVENT = "mantora:appearance";

function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
    notify();
  };
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", storage);
  };
}

function snapshot() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** Appearance only: does not remount the editor or access its stored drafts. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => "light");
  const dark = theme === "dark";
  const Icon = dark ? Sun : Moon;
  return (
    <button
      type="button"
      className="mantora-theme-toggle"
      aria-label={`Ativar tema ${dark ? "claro" : "escuro"}`}
      aria-pressed={dark}
      title={`Mudar para tema ${dark ? "claro" : "escuro"}`}
      onClick={() => {
        const next = dark ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem(KEY, next); } catch { /* Theme also works without storage. */ }
        window.dispatchEvent(new Event(EVENT));
      }}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{dark ? "Claro" : "Escuro"}</span>
    </button>
  );
}

