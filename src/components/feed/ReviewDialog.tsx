"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, X, XCircle } from "lucide-react";
import type { ReviewIssue } from "@/lib/review/checks";
import { runReview } from "@/lib/review/run";
import type { FeedBrand, FeedStyle } from "@/lib/templates/feed";
import type { FeedEditorSlide } from "./useFeedDraft";

interface Fix {
  tela: number;
  trecho: string;
  sugestao: string;
  motivo: string;
}

/**
 * Revisão da peça. "revisar": aberta pelo botão Revisar. "baixar": antes do download; sem erro,
 * segue sozinha; com erro, mostra a lista e deixa baixar assim mesmo.
 */
export function ReviewDialog({
  mode,
  slides,
  brand,
  style,
  legenda,
  clienteSlug,
  onGoTo,
  onApplyFix,
  onProceed,
  onClose,
}: {
  mode: "revisar" | "baixar";
  slides: FeedEditorSlide[];
  brand: FeedBrand;
  style: FeedStyle;
  legenda: string | null;
  clienteSlug: string | null;
  onGoTo: (tela: number, elementId?: string) => void;
  /** Aplica uma correção de português (tela 1…; 0 = legenda). Devolve false se não achou o trecho. */
  onApplyFix: (fix: Fix) => boolean;
  onProceed?: () => void;
  onClose: () => void;
}) {
  const [issues, setIssues] = useState<ReviewIssue[] | null>(null);
  const [fixes, setFixes] = useState<(Fix & { applied?: boolean })[] | null>(null);
  const [proofing, setProofing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    runReview({ slides, brand, style, legenda })
      .then((found) => {
        if (cancelled) return;
        if (mode === "baixar" && !found.some((x) => x.nivel === "erro")) {
          onProceed?.();
          return;
        }
        setIssues(found);
      })
      .catch((e) => {
        console.error(e);
        if (cancelled) return;
        if (mode === "baixar") onProceed?.();
        else setIssues([]);
      });
    return () => {
      cancelled = true;
    };
    // Revisa o estado da peça no momento em que a janela abriu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const proofread = async () => {
    setProofing(true);
    setError("");
    try {
      const telas = slides.map((sl) =>
        sl.layout === "livre" && sl.free ? sl.free.elements.map((e) => (e.text ?? "").trim()).filter(Boolean) : [sl.title, sl.body].filter((t) => t.trim()),
      );
      const response = await fetch("/api/estudio/revisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telas, legenda: legenda ?? "", cliente: clienteSlug }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Falha ao revisar.");
      setFixes(data.erros ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao revisar.");
    } finally {
      setProofing(false);
    }
  };

  if (!issues) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Revisando">
        <div className="flex items-center gap-3 rounded-2xl bg-surface px-5 py-4 text-[13.5px] shadow-2xl">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          Conferindo as telas…
        </div>
      </div>
    );
  }

  const groups = new Map<number | null, ReviewIssue[]>();
  for (const x of [...issues].sort((a, b) => (a.tela ?? -1) - (b.tela ?? -1) || (a.nivel === "erro" ? -1 : 1))) {
    groups.set(x.tela, [...(groups.get(x.tela) ?? []), x]);
  }
  const errors = issues.filter((x) => x.nivel === "erro").length;
  const warnings = issues.length - errors;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Revisão da peça">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold">{mode === "baixar" ? "Antes de baixar" : "Revisão da peça"}</h2>
            <p className="text-[12.5px] text-ink-soft">
              {issues.length
                ? `${errors ? `${errors} problema(s)` : ""}${errors && warnings ? " e " : ""}${warnings ? `${warnings} aviso(s)` : ""}. Clique para ir até a tela.`
                : "Nada de errado nas telas e na legenda."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        {issues.length === 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-canvas p-3 text-[13px] text-ink-soft">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Texto dentro da tela, letra legível, contraste ok, fotos no lugar.
          </div>
        )}

        {[...groups.entries()].map(([tela, list]) => (
          <div key={String(tela)} className="space-y-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">{tela === null ? "Legenda" : `Tela ${tela + 1}`}</p>
            {list.map((x, k) => (
              <button
                key={k}
                type="button"
                onClick={() => (x.tela !== null ? onGoTo(x.tela, x.elementId) : undefined)}
                className="flex w-full items-start gap-2 rounded-lg border border-line px-3 py-2 text-left text-[13px] hover:border-line-strong"
              >
                {x.nivel === "erro" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
                <span>{x.msg}</span>
              </button>
            ))}
          </div>
        ))}

        <div className="space-y-2 rounded-xl border border-line p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">Português</p>
            <button
              type="button"
              onClick={proofread}
              disabled={proofing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
            >
              {proofing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {fixes ? "Revisar de novo" : "Revisar com IA · centavos"}
            </button>
          </div>
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
          {fixes && fixes.length === 0 && <p className="text-[12.5px] text-ink-soft">Nenhum erro de português encontrado.</p>}
          {fixes?.map((f, k) => (
            <div key={k} className="rounded-lg bg-canvas px-3 py-2 text-[12.5px]">
              <p className="text-ink-faint">{f.tela === 0 ? "Legenda" : `Tela ${f.tela}`} · {f.motivo}</p>
              <p>
                <span className="text-danger line-through">{f.trecho}</span> → <strong>{f.sugestao}</strong>
              </p>
              <button
                type="button"
                disabled={f.applied}
                onClick={() => {
                  const ok = onApplyFix(f);
                  setFixes((all) => all?.map((x, i) => (i === k ? { ...x, applied: ok } : x)) ?? null);
                  if (!ok) setError(`Não achei "${f.trecho}" para trocar. Corrija direto na tela.`);
                }}
                className="mt-1 text-[12px] font-medium text-accent underline disabled:no-underline disabled:opacity-60"
              >
                {f.applied ? "Corrigido" : "Aplicar correção"}
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          {mode === "baixar" ? (
            <>
              <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink-soft hover:text-ink">
                Voltar e corrigir
              </button>
              <button type="button" onClick={onProceed} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent/90">
                Baixar assim mesmo
              </button>
            </>
          ) : (
            <button type="button" onClick={onClose} className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent/90">
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
