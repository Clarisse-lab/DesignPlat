"use client";

// Página que o cliente abre pelo link de aprovação: vê as telas (vídeo nas animadas) e a legenda,
// comenta em cada uma e aprova ou pede ajustes. Sem login: o token do link é a chave.

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, MessageSquare, PencilLine } from "lucide-react";

interface Dados {
  titulo: string;
  cliente: string | null;
  legenda: string | null;
  status: "pendente" | "aprovado" | "ajustes";
  respondido_por: string | null;
  respondido_em: string | null;
  telas: { url: string; tipo: "png" | "mp4" }[];
  comentarios: { tela: number | null; autor: string; texto: string; criado_em: string }[];
}

const NAME_KEY = "aprovacao-nome";
const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Comments({ list }: { list: Dados["comentarios"] }) {
  if (!list.length) return null;
  return (
    <ul className="space-y-1.5">
      {list.map((c, k) => (
        <li key={k} className="rounded-lg bg-canvas px-3 py-2 text-[13px]">
          <span className="font-semibold">{c.autor}</span> <span className="text-ink-faint">· {fmt(c.criado_em)}</span>
          <p className="whitespace-pre-wrap">{c.texto}</p>
        </li>
      ))}
    </ul>
  );
}

function CommentBox({ onSend, disabled }: { onSend: (texto: string) => Promise<boolean>; disabled: boolean }) {
  const [texto, setTexto] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-2">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={1}
        maxLength={2000}
        placeholder="Comentar esta tela…"
        className="min-h-[40px] flex-1 resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px]"
      />
      <button
        type="button"
        disabled={disabled || busy || !texto.trim()}
        onClick={async () => {
          setBusy(true);
          if (await onSend(texto.trim())) setTexto("");
          setBusy(false);
        }}
        className="inline-flex items-center gap-1.5 self-start rounded-lg border border-line px-3 py-2 text-[13px] font-medium text-ink-soft hover:text-ink disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
        Enviar
      </button>
    </div>
  );
}

export default function AprovarPage() {
  const { token } = useParams<{ token: string }>();
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState("");
  const [nome, setNome] = useState("");
  const [ajustes, setAjustes] = useState<string | null>(null);
  const [busy, setBusy] = useState<"aprovar" | "ajustes" | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/aprovar/${token}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) setErro(data.error ?? "Link inválido.");
    else setDados(data);
  }, [token]);

  useEffect(() => {
    try {
      // Nome lembrado neste aparelho para não digitar a cada comentário.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNome(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      /* sem armazenamento: digita de novo */
    }
    void load();
  }, [load]);

  const send = async (body: { acao: "comentar" | "aprovar" | "ajustes"; tela?: number | null; texto?: string }): Promise<boolean> => {
    if (nome.trim().length < 2) {
      setErro("Escreva seu nome no topo da página antes de comentar ou aprovar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return false;
    }
    setErro("");
    try {
      localStorage.setItem(NAME_KEY, nome.trim());
    } catch {
      /* ignora */
    }
    const response = await fetch(`/api/aprovar/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, autor: nome.trim() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setErro(data.error ?? "Não foi possível enviar.");
      return false;
    }
    await load();
    return true;
  };

  if (erro && !dados) return <p className="mx-auto max-w-xl p-8 text-center text-[15px] text-ink-soft">{erro}</p>;
  if (!dados) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-ink-soft">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const decided = dados.status !== "pendente";
  const byTela = (tela: number | null) => dados.comentarios.filter((c) => c.tela === tela);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-32 pt-6">
      <div className="space-y-1">
        <p className="text-[12.5px] font-semibold uppercase tracking-wide text-ink-faint">Aprovação de post{dados.cliente ? ` · ${dados.cliente}` : ""}</p>
        <h1 className="text-[22px] font-bold leading-tight">{dados.titulo}</h1>
        <p className="text-[13.5px] text-ink-soft">Veja as telas, comente o que quiser mudar em cada uma e, no fim, aprove ou peça ajustes.</p>
      </div>

      {decided && (
        <div className={`flex items-start gap-2 rounded-xl px-4 py-3 text-[14px] ${dados.status === "aprovado" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"}`}>
          {dados.status === "aprovado" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <PencilLine className="mt-0.5 h-5 w-5 shrink-0" />}
          <span>
            {dados.status === "aprovado" ? "Aprovado" : "Ajustes pedidos"} por <strong>{dados.respondido_por}</strong>
            {dados.respondido_em ? ` em ${fmt(dados.respondido_em)}` : ""}. A equipe já recebeu.
          </span>
        </div>
      )}

      <label className="block space-y-1">
        <span className="text-[13px] font-medium text-ink-soft">Seu nome</span>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={80}
          placeholder="Como você quer aparecer nos comentários"
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px]"
        />
      </label>
      {erro && <p className="text-[13px] text-danger">{erro}</p>}

      {dados.telas.map((t, i) => (
        <section key={i} className="space-y-2 rounded-2xl border border-line bg-surface p-3">
          <p className="text-[12.5px] font-semibold text-ink-faint">
            Tela {i + 1} de {dados.telas.length}
            {t.tipo === "mp4" ? " · animada" : ""}
          </p>
          {t.tipo === "mp4" ? (
            <video src={t.url} autoPlay muted loop playsInline controls className="w-full rounded-lg" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.url} alt={`Tela ${i + 1}`} className="w-full rounded-lg" />
          )}
          <Comments list={byTela(i)} />
          <CommentBox onSend={(texto) => send({ acao: "comentar", tela: i, texto })} disabled={false} />
        </section>
      ))}

      {dados.legenda && (
        <section className="space-y-2 rounded-2xl border border-line bg-surface p-4">
          <p className="text-[12.5px] font-semibold text-ink-faint">Legenda</p>
          <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{dados.legenda}</p>
          <Comments list={byTela(null)} />
          <CommentBox onSend={(texto) => send({ acao: "comentar", tela: null, texto })} disabled={false} />
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl space-y-2">
          {ajustes !== null && (
            <textarea
              value={ajustes}
              onChange={(e) => setAjustes(e.target.value)}
              rows={2}
              maxLength={2000}
              autoFocus
              placeholder="O que precisa ajustar? (os comentários nas telas também vão para a equipe)"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-[14px]"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={async () => {
                if (ajustes === null) {
                  setAjustes("");
                  return;
                }
                if (!ajustes.trim()) {
                  setErro("Diga o que precisa ajustar.");
                  return;
                }
                setBusy("ajustes");
                if (await send({ acao: "ajustes", texto: ajustes.trim() })) setAjustes(null);
                setBusy(null);
              }}
              className="flex-1 rounded-xl border border-line px-4 py-3 text-[14px] font-semibold text-ink hover:border-line-strong disabled:opacity-50"
            >
              {busy === "ajustes" ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : ajustes === null ? "Pedir ajustes" : "Enviar ajustes"}
            </button>
            <button
              type="button"
              disabled={busy !== null || dados.status === "aprovado"}
              onClick={async () => {
                setBusy("aprovar");
                await send({ acao: "aprovar" });
                setBusy(null);
              }}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-[14px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy === "aprovar" ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : dados.status === "aprovado" ? "Aprovado ✓" : "Aprovar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
