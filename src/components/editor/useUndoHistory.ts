"use client";

import { useEffect, useRef, useState } from "react";
import { UndoStack } from "@/lib/undo-stack";

/**
 * Desfazer/refazer para um editor. `value` é o que pode ser desfeito; `onRestore` aplica um valor antigo.
 * Atalhos: Ctrl+Z (Cmd+Z) desfaz; Ctrl+Shift+Z ou Ctrl+Y refaz. Dentro de um campo de texto,
 * o atalho fica com o próprio campo (desfaz a digitação).
 * Enquanto `enabled` é falso (rascunho ainda carregando), nada vira passo.
 */
export function useUndoHistory<T>(value: T, equals: (a: T, b: T) => boolean, onRestore: (value: T) => void, enabled: boolean) {
  const stackRef = useRef<UndoStack<T> | null>(null);
  if (!stackRef.current) stackRef.current = new UndoStack<T>(equals);
  const stack = stackRef.current;
  const [flags, setFlags] = useState({ canUndo: false, canRedo: false });
  const restoreRef = useRef(onRestore);
  useEffect(() => {
    restoreRef.current = onRestore;
  });

  const sync = () =>
    setFlags((f) => (f.canUndo === stack.canUndo && f.canRedo === stack.canRedo ? f : { canUndo: stack.canUndo, canRedo: stack.canRedo }));

  useEffect(() => {
    if (!enabled) stack.reset();
    stack.record(value, Date.now());
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, enabled]);

  const undo = () => {
    const v = stack.undo();
    if (v !== undefined) restoreRef.current(v);
    sync();
  };
  const redo = () => {
    const v = stack.redo();
    if (v !== undefined) restoreRef.current(v);
    sync();
  };

  const actionsRef = useRef({ undo, redo });
  useEffect(() => {
    actionsRef.current = { undo, redo };
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        actionsRef.current.undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        actionsRef.current.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return {
    ...flags,
    undo,
    redo,
    /** A próxima mudança começa um histórico novo. */
    reset: () => stack.reset(),
    /** A próxima mudança não vira passo de desfazer. */
    silent: () => stack.silent(),
  };
}
