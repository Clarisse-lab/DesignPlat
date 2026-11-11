"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Copy, ExternalLink, Link2, Loader2, MessageCircle, PencilLine, X } from "lucide-react";

export interface Aprovacao {
  id: string;
  token: string;
  titulo: string;
  status: "pendente" | "aprovado" | "ajustes";
  respondido_por: string | null;
  respondido_em: string | null;
  criado_por: string | null;
  criado_em: string;
  telas: { path: string; tipo: "png" | "mp4" }[];
  comentarios: { id: string; tela: number | null; autor: string; texto: string; criado_em: string }[];
}

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const approvalUrl = (token: string) => `${window.location.origin}/aprovar/${token}`;

/** Links de aprovação da peça (o mais novo primeiro), recarregados de tempos em tempos. */
export function useApprovals(pecaId: string | null) {
  const [list, setList] = useState<Aprovacao[]>([]);
  const reload = useCallback(async () => {
    if (!pecaId) {
      setList([]);
      return;
    }
    const response = await fetch(`/api/estudio/aprovacoes?peca=${pecaId}`).catch(() => null);
    const data = response?.ok ? await response.json().catch(() => ({})) : {};
    setList(data.aprovacoes ?? []);
  }, [pecaId]);
  useEffect(() => {
    // Busca ao abrir a peça e a cada 90 s (o cliente pode responder a qualquer momento).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    const timer = window.setInterval(() => void reload(), 90_000);
    return () => window.clearInterval(timer);
  }, [reload]);
  return { list, reload };
}

export function StatusChip({ a }: { a: Aprovacao }) {
  const n = a.comentarios.length;
  if (a.status === "aprovado") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4" /> Aprovado
      </span>
    );
  }
  if (a.status === "ajustes") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
        <PencilLine className="h-4 w-4" /> Ajustes{n ? ` (${n})` : ""}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-ink-soft">
      <Clock className="h-4 w-4" /> Aguardando{n ? ` · ${n} coment.` : ""}
    </span>
  );
}

export function ApprovalDialog({
  approvals,
  reload,
  ensureSaved,
  buildRequest,
  onGoTo,
  onClose,
}: {
  approvals: Aprovacao[];
  reload: () => Promise<void>;
  /** Salva a peça e devolve o id (o link fica ligado a ela). */
  ensureSaved: () => Promise<string | null>;
  /** Dados da versão atual para renderizar o link. */
  buildRequest: () => { render: unknown; titulo: string; legenda: string | null; cliente_slug: string | null };
  onGoTo: (tela: number) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const latest = approvals[0] ?? null;

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const peca_id = await ensureSaved();
      const response = await fetch("/api/estudio/aprovacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...buildRequest(), peca_id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Não foi possível criar o link.");
      await reload();
      if (!peca_id) setError("A peça não foi salva, então o retorno do cliente não aparece aqui. Guarde o link.");
      const url = approvalUrl(data.aprovacao.token);
      await navigator.clipboard?.writeText(url).then(() => setCopied(true), () => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o link.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url: string) => {
    await navigator.clipboard?.writeText(url).then(() => setCopied(true), () => undefined);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const comentarios = latest?.comentarios ?? [];
  const byTela = new Map<number | null, Aprovacao["comentarios"]>();
  for (const c of comentarios) byTela.set(c.tela, [...(byTela.get(c.tela) ?? []), c]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Aprovação do cliente">
      <div className="absolute inset-0 bg-black/50" onClick={busy ? undefined : onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl bg-surface p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-bold">Aprovação do cliente</h2>
            <p className="text-[12.5px] text-ink-soft">
              O link mostra as telas como estão agora (animadas em vídeo) e a legenda. O cliente comenta por tela e aprova ou pede ajustes, sem login.
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Fechar" className="rounded-md p-1 text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        {latest && (
          <div className="space-y-2 rounded-xl border border-line p-3 text-[13px]">
            <div className="flex items-center justify-between gap-2">
              <StatusChip a={latest} />
              <span className="text-[12px] text-ink-faint">
                link de {fmt(latest.criado_em)}
                {latest.respondido_em ? ` · resposta ${fmt(latest.respondido_em)} (${latest.respondido_por})` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => copy(approvalUrl(latest.token))} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-medium text-ink-soft hover:text-ink">
                <Copy className="h-3.5 w-3.5" /> {copied ? "Copiado!" : "Copiar link"}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Oi! Segue o post para aprovação: ${approvalUrl(latest.token)}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-medium text-ink-soft hover:text-ink"
              >
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
              <a href={approvalUrl(latest.token)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-medium text-ink-soft hover:text-ink">
                <ExternalLink className="h-3.5 w-3.5" /> Abrir
              </a>
            </div>
            {comentarios.length > 0 && (
              <div className="space-y-2 pt-1">
                {[...byTela.entries()]
                  .sort(([a], [b]) => (a ?? 99) - (b ?? 99))
                  .map(([tela, list]) => (
                    <div key={String(tela)} className="space-y-1">
                      {tela !== null ? (
                        <button type="button" onClick={() => onGoTo(tela)} className="text-[12px] font-semibold text-accent underline">
                          Tela {tela + 1}
                        </button>
                      ) : (
                        <p className="text-[12px] font-semibold text-ink-faint">Legenda / geral</p>
                      )}
                      {list.map((c) => (
                        <p key={c.id} className="rounded-lg bg-canvas px-3 py-1.5">
                          <strong>{c.autor}:</strong> {c.texto}
                        </p>
                      ))}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {approvals.length > 1 && <p className="text-[12px] text-ink-faint">{approvals.length - 1} link(s) de versões anteriores desta peça.</p>}
        {error && <p className="text-[12.5px] text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={create}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            {busy ? "Preparando as telas…" : latest ? "Gerar link da versão atual" : "Gerar link de aprovação"}
          </button>
        </div>
      </div>
    </div>
  );
}
