"use client";

// Link fixo do relatório semanal do cliente: sempre a semana publicada mais recente, com seletor para as anteriores.
// Sem login: o token do link é a chave. Rascunhos nunca aparecem aqui.

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { RelatorioView } from "@/components/relatorio/RelatorioView";
import type { RelatorioView as View } from "@/lib/relatorio/tipos";

export default function RelatorioClientePage() {
  const { token } = useParams<{ token: string }>();
  // undefined = ainda não leu a URL; null = semana mais recente.
  const [semana, setSemana] = useState<string | null | undefined>(undefined);
  const [view, setView] = useState<View | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setSemana(new URLSearchParams(window.location.search).get("semana"));
  }, []);

  useEffect(() => {
    if (semana === undefined) return;
    let cancelado = false;
    setErro("");
    fetch(`/api/r/${encodeURIComponent(token)}${semana ? `?semana=${semana}` : ""}`, { cache: "no-store" })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (cancelado) return;
        if (!r.ok) throw new Error(body.error ?? "Não foi possível abrir o relatório.");
        setView(body as View);
        document.title = `${(body as View).cliente.nome} · Relatório semanal · Mantora`;
      })
      .catch((e) => !cancelado && setErro(e instanceof Error ? e.message : "Não foi possível abrir o relatório."));
    return () => {
      cancelado = true;
    };
  }, [token, semana]);

  if (erro) {
    return (
      <div className="rs-espera">
        <p className="rs-espera-marca">
          mantora<sup>®</sup>
        </p>
        <p>{erro}</p>
      </div>
    );
  }
  if (!view) {
    return (
      <div className="rs-espera" aria-busy="true">
        <p className="rs-espera-marca">
          mantora<sup>®</sup>
        </p>
        <span className="rs-espera-barra" />
      </div>
    );
  }
  return (
    <RelatorioView
      key={view.semana.semana_inicio}
      view={view}
      onSemana={(inicio) => {
        setView(null);
        window.history.replaceState(null, "", `${window.location.pathname}?semana=${inicio}`);
        window.scrollTo({ top: 0 });
        setSemana(inicio);
      }}
    />
  );
}
