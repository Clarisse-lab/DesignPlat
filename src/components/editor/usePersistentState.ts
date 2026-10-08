"use client";

import { useEffect, useState } from "react";

/**
 * Estado salvo no localStorage do navegador. Só restaura depois de montar,
 * para não divergir da renderização do servidor.
 */
export function usePersistentState<T>(key: string, initial: () => T, isValid: (value: unknown) => value is T) {
  const [state, setState] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      // Restaurar do localStorage só é possível depois de montar no navegador.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isValid(parsed)) setState(parsed);
    } catch {
      // rascunho corrompido ou armazenamento bloqueado: segue com o estado inicial
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // armazenamento cheio ou bloqueado: o editor continua funcionando sem salvar
    }
  }, [key, state, loaded]);

  return [state, setState] as const;
}
