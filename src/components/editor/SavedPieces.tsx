"use client";

// Salvar e abrir peças e templates no Supabase (toda a equipe vê). Com o salvamento automático,
// a peça vai para o Supabase sozinha alguns segundos depois de cada mudança, marcada como rascunho
// até alguém dar um nome em "Salvar". O rascunho do navegador continua como rede de segurança.

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2, X } from "lucide-react";

export type Ferramenta = "feed" | "story" | "apresentacao" | "tweet";

interface PieceSummary {
  id: string;
  ferramenta: Ferramenta;
  titulo: string;
  cliente_slug: string | null;
  template: boolean;
  rascunho?: boolean;
  atualizado_em: string;
  atualizado_por: string | null;
}

export interface OpenedPiece {
  id: string | null;
  titulo: string;
  cliente_slug: string | null;
  dados: Record<string, unknown>;
  template: boolean;
}

const whenBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

async function savePiece(body: {
  id: string | null;
  ferramenta: Ferramenta;
  titulo: string;
  cliente_slug: string | null;
  template: boolean;
  rascunho?: boolean;
  dados: Record<string, unknown>;
}): Promise<{ id: string }> {
  const response = await fetch("/api/estudio/pecas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error ?? "Erro ao salvar.");
  return data;
}

/**
 * Salvar e abrir peças: devolve as ações para o editor colocar onde quiser (botão Salvar e menu)
 * e a janela de abrir, que o editor renderiza.
 */
export function useSavedPieces({
  ferramenta,
  pecaId,
  titulo,
  clienteSlug,
  clienteNome,
  suggestedTitle,
  getDados,
  onSaved,
  onOpen,
  onError,
  onInfo,
  autoSave = false,
  contentKey = "",
  hasContent = false,
  onAutoSaved,
}: {
  ferramenta: Ferramenta;
  pecaId: string | null;
  titulo: string | null;
  clienteSlug: string | null;
  clienteNome: string | null;
  /** Título sugerido quando a peça ainda não tem nome (ex.: o título do primeiro slide). */
  suggestedTitle: string;
  getDados: () => Record<string, unknown>;
  onSaved: (id: string, titulo: string) => void;
  /** Devolve false quando não abriu (cancelou ou peça inválida). */
  onOpen: (piece: OpenedPiece) => boolean | void;
  onError: (message: string) => void;
  onInfo: (message: string) => void;
  /** Salvar sozinho no Supabase (precisa do login da equipe). */
  autoSave?: boolean;
  /** Assinatura barata do conteúdo: quando muda, agenda o salvamento automático. */
  contentKey?: string;
  /** Só salva sozinho quando já tem algo (título, texto ou imagem). */
  hasContent?: boolean;
  /** A peça ganhou id no primeiro salvamento automático (sem nome ainda). */
  onAutoSaved?: (id: string) => void;
}) {
  const [busy, setBusy] = useState<"save" | "template" | null>(null);
  const [browsing, setBrowsing] = useState(false);
  const [autoStatus, setAutoStatus] = useState<{ kind: "salvando" | "salvo" | "erro"; at?: string } | null>(null);

  // ---------- Salvamento automático ----------
  // Tudo em refs: o efeito só olha a assinatura do conteúdo e lê o resto na hora de salvar.
  const latest = useRef({ pecaId, titulo, clienteSlug, suggestedTitle, getDados, onAutoSaved, ferramenta, contentKey });
  latest.current = { pecaId, titulo, clienteSlug, suggestedTitle, getDados, onAutoSaved, ferramenta, contentKey };
  /** id criado pelo salvamento automático antes de o editor atualizar (evita criar duas peças). */
  const createdId = useRef<string | null>(null);
  /** Conteúdo igual ao que está no Supabase (não salva de novo). */
  const savedKey = useRef<string | null>(null);
  /** Acabou de abrir uma peça ou template: o conteúdo aberto é a referência, não uma mudança. */
  const justOpened = useRef(false);
  const inFlight = useRef(false);
  const pending = useRef(false);

  // Peça trocada por fora (abrir, recomeçar, gerar carrossel novo): esquece o id criado antes.
  useEffect(() => {
    if (pecaId !== createdId.current) createdId.current = null;
  }, [pecaId]);

  useEffect(() => {
    if (!autoSave) return;
    if (justOpened.current) {
      justOpened.current = false;
      savedKey.current = contentKey;
      return;
    }
    if (!hasContent || contentKey === savedKey.current) return;
    const timer = window.setTimeout(async function run() {
      if (inFlight.current) {
        pending.current = true;
        return;
      }
      inFlight.current = true;
      setAutoStatus({ kind: "salvando" });
      const cur = latest.current;
      const key = cur.contentKey;
      const id = cur.pecaId ?? createdId.current;
      try {
        const saved = await savePiece({
          id,
          ferramenta: cur.ferramenta,
          titulo: (cur.titulo || `Rascunho: ${cur.suggestedTitle || "sem título"}`).slice(0, 120),
          cliente_slug: cur.clienteSlug,
          template: false,
          rascunho: !cur.titulo,
          dados: cur.getDados(),
        });
        savedKey.current = key;
        if (!id) {
          createdId.current = saved.id;
          cur.onAutoSaved?.(saved.id);
        }
        setAutoStatus({ kind: "salvo", at: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) });
      } catch {
        setAutoStatus({ kind: "erro" });
      } finally {
        inFlight.current = false;
        if (pending.current) {
          pending.current = false;
          window.setTimeout(run, 1500);
        }
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [autoSave, contentKey, hasContent]);

  const save = async (asTemplate: boolean) => {
    const base = asTemplate ? `Template ${clienteNome ?? ""}`.trim() : titulo || suggestedTitle;
    const name = asTemplate || !titulo ? window.prompt(asTemplate ? "Nome do template:" : "Nome da peça:", base)?.trim() : titulo;
    if (!name) return;
    setBusy(asTemplate ? "template" : "save");
    try {
      const saved = await savePiece({
        id: asTemplate ? null : (pecaId ?? createdId.current),
        ferramenta,
        titulo: name.slice(0, 120),
        cliente_slug: clienteSlug,
        template: asTemplate,
        rascunho: false,
        dados: getDados(),
      });
      if (asTemplate) onInfo(`Template "${name}" salvo. Ele aparece em Abrir → Templates.`);
      else {
        onSaved(saved.id, name);
        createdId.current = saved.id;
        onInfo(`Peça "${name}" salva para a equipe.`);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erro ao salvar.");
    } finally {
      setBusy(null);
    }
  };

  const dialog = browsing ? (
    <PiecesDialog
      ferramenta={ferramenta}
      clienteSlug={clienteSlug}
      onClose={() => setBrowsing(false)}
      onOpen={(piece) => {
        setBrowsing(false);
        // O editor devolve false se a pessoa cancelou: aí não há conteúdo aberto para ignorar.
        if (onOpen(piece) !== false) justOpened.current = true;
      }}
      onError={onError}
    />
  ) : null;

  const autoLabel = !autoSave
    ? null
    : autoStatus?.kind === "salvando"
      ? "Salvando…"
      : autoStatus?.kind === "erro"
        ? "Não salvou: confira a conexão"
        : autoStatus?.kind === "salvo"
          ? `Salvo às ${autoStatus.at}`
          : null;

  return { busy, save, openBrowser: () => setBrowsing(true), dialog, saved: Boolean(pecaId ?? createdId.current), autoLabel, autoError: autoStatus?.kind === "erro" };
}

function PiecesDialog({
  ferramenta,
  clienteSlug,
  onClose,
  onOpen,
  onError,
}: {
  ferramenta: Ferramenta;
  clienteSlug: string | null;
  onClose: () => void;
  onOpen: (piece: OpenedPiece) => void;
  onError: (message: string) => void;
}) {
  const [tab, setTab] = useState<"pecas" | "templates">("pecas");
  const [onlyClient, setOnlyClient] = useState(Boolean(clienteSlug));
  const [list, setList] = useState<PieceSummary[] | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  // onError muda a cada render do editor: fica numa ref para não refazer a busca em loop.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams({ ferramenta, template: tab === "templates" ? "1" : "0" });
    if (onlyClient && clienteSlug) query.set("cliente", clienteSlug);
    fetch(`/api/estudio/pecas?${query}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error ?? "Erro ao listar.");
        if (!cancelled) setList(data.pecas);
      })
      .catch((e) => {
        if (!cancelled) {
          setList([]);
          onErrorRef.current(e instanceof Error ? e.message : "Erro ao listar.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ferramenta, tab, onlyClient, clienteSlug, reload]);

  const open = async (summary: PieceSummary) => {
    setOpening(summary.id);
    try {
      const response = await fetch(`/api/estudio/pecas/${summary.id}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Erro ao abrir.");
      // Template abre como peça nova: salvar não sobrescreve o template.
      onOpen({
        id: summary.template ? null : summary.id,
        // Rascunho automático abre sem nome: "Salvar" pede um nome e tira a marca de rascunho.
        titulo: summary.template || summary.rascunho ? "" : summary.titulo,
        cliente_slug: summary.cliente_slug,
        dados: data.dados,
        template: summary.template,
      });
    } catch (error) {
      onError(error instanceof Error ? error.message : "Erro ao abrir.");
    } finally {
      setOpening(null);
    }
  };

  const remove = async (summary: PieceSummary) => {
    if (!window.confirm(`Apagar "${summary.titulo}"? Isso vale para toda a equipe.`)) return;
    const response = await fetch(`/api/estudio/pecas/${summary.id}`, { method: "DELETE" });
    if (!response.ok) onError("Não foi possível apagar.");
    setReload((n) => n + 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Abrir peça">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 rounded-2xl bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-lg bg-canvas p-1">
            {(["pecas", "templates"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setList(null);
                  setTab(t);
                }}
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium ${tab === t ? "bg-surface text-ink shadow-sm" : "text-ink-soft"}`}
              >
                {t === "pecas" ? "Peças salvas" : "Templates"}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-ink-soft hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        {clienteSlug && (
          <label className="flex items-center gap-2 text-[13px] text-ink-soft">
            <input
              type="checkbox"
              checked={onlyClient}
              onChange={(e) => {
                setList(null);
                setOnlyClient(e.target.checked);
              }}
              className="h-4 w-4 accent-accent"
            />
            Só do cliente selecionado
          </label>
        )}
        <div className="min-h-[160px] overflow-y-auto">
          {list === null ? (
            <p className="flex items-center gap-2 py-6 text-[13px] text-ink-soft">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </p>
          ) : list.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-ink-faint">
              {tab === "pecas" ? "Nenhuma peça salva ainda. As peças novas se salvam sozinhas enquanto você edita." : "Nenhum template ainda. Use \"Salvar como template\" numa peça pronta."}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {list.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <button type="button" onClick={() => open(p)} disabled={opening !== null} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14px] font-medium">{p.titulo}</span>
                      {p.rascunho && <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-[10.5px] font-medium text-ink-soft">rascunho automático</span>}
                    </span>
                    <span className="block text-[12px] text-ink-faint">
                      {p.cliente_slug ?? "sem cliente"} · {whenBR(p.atualizado_em)}
                      {p.atualizado_por ? ` · ${p.atualizado_por}` : ""}
                    </span>
                  </button>
                  {opening === p.id && <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />}
                  <button type="button" onClick={() => remove(p)} aria-label="Apagar" title="Apagar" className="rounded-md p-1.5 text-ink-faint hover:text-danger">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
