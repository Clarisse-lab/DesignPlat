"use client";

// Google Drive: conectar a conta dona das pastas dos clientes e conferir a pasta de cada um.
// Peça aprovada pelo cliente vai para <pasta do cliente>/05 - Designer/<ano>/<MM_Mês>/<dd-mm - título>/.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

interface Dados {
  configurado: boolean;
  conectado: { email: string | null; conectado_em: string } | null;
  clientes: { slug: string; nome: string; pasta: { pasta_id: string; pasta_nome: string | null } | null }[];
}

export default function DrivePage() {
  const [dados, setDados] = useState<Dados | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "erro"; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/drive");
    const data = await response.json().catch(() => ({}));
    if (response.ok) setDados(data);
    else setMsg({ kind: "erro", text: data.error ?? "Erro ao carregar." });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Volta da conexão com o Google (?ok= ou ?erro=), lida uma vez.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("ok")) setMsg({ kind: "ok", text: "Google Drive conectado." });
    else if (params.get("erro")) setMsg({ kind: "erro", text: params.get("erro")! });
    if (params.size) history.replaceState(null, "", "/drive");
    void load();
  }, [load]);

  const connect = async () => {
    setBusy(true);
    const response = await fetch("/api/drive/conectar", { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) window.location.href = data.url;
    else {
      setMsg({ kind: "erro", text: data.error ?? "Erro ao conectar." });
      setBusy(false);
    }
  };

  const savePasta = async (slug: string) => {
    setBusy(true);
    const response = await fetch("/api/drive/pastas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente_slug: slug, pasta: link }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMsg({ kind: "erro", text: data.error ?? "Não deu para salvar a pasta." });
      return;
    }
    setEditing(null);
    setLink("");
    setMsg({ kind: "ok", text: `Pasta salva: ${data.pasta.pasta_nome}` });
    await load();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
      <div>
        <h1 className="text-[22px] font-bold">Google Drive</h1>
        <p className="text-[13.5px] text-ink-soft">
          Quando o cliente aprova uma peça pelo link, as telas (PNG e MP4) e a legenda vão sozinhas para a pasta dele:{" "}
          <strong>05 - Designer / ano / mês / dia - título</strong>. As pastas que faltarem são criadas.
        </p>
      </div>

      {msg && <p className={`rounded-lg px-3 py-2 text-[13px] ${msg.kind === "ok" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-canvas text-danger"}`}>{msg.text}</p>}

      {!dados ? (
        <div className="grid min-h-[30vh] place-items-center text-ink-soft">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <section className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-[15px] font-bold">Conexão</h2>
            {!dados.configurado ? (
              <p className="text-[13px] text-ink-soft">
                Falta configurar no Railway: <code>GOOGLE_CLIENT_ID</code> e <code>GOOGLE_CLIENT_SECRET</code>.
              </p>
            ) : dados.conectado ? (
              <p className="flex items-center gap-2 text-[13.5px]">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Conectado como <strong>{dados.conectado.email ?? "conta do Google"}</strong>
              </p>
            ) : (
              <p className="text-[13px] text-ink-soft">Ainda não conectado. Entre com a conta do Google que é dona das pastas dos clientes.</p>
            )}
            {dados.configurado && (
              <button
                type="button"
                onClick={connect}
                disabled={busy}
                className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {dados.conectado ? "Conectar outra conta" : "Conectar Google Drive"}
              </button>
            )}
          </section>

          <section className="space-y-2 rounded-2xl border border-line bg-surface p-4">
            <h2 className="text-[15px] font-bold">Pasta de cada cliente</h2>
            <div className="divide-y divide-line text-[13.5px]">
              {dados.clientes.map((c) => (
                <div key={c.slug} className="space-y-2 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{c.nome}</p>
                      <p className="truncate text-[12px] text-ink-faint">{c.pasta ? c.pasta.pasta_nome : "sem pasta definida"}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {c.pasta && (
                        <a href={`https://drive.google.com/drive/folders/${c.pasta.pasta_id}`} target="_blank" rel="noreferrer" aria-label="Abrir pasta" className="text-ink-soft hover:text-ink">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button type="button" onClick={() => { setEditing(c.slug); setLink(""); }} className="text-[12.5px] text-accent underline">
                        {c.pasta ? "trocar" : "definir"}
                      </button>
                    </div>
                  </div>
                  {editing === c.slug && (
                    <div className="flex gap-2">
                      <input
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="Cole o link da pasta do cliente no Drive"
                        className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[13px]"
                      />
                      <button
                        type="button"
                        disabled={busy || !link.trim() || !dados.conectado}
                        onClick={() => savePasta(c.slug)}
                        className="rounded-lg border border-line px-3 py-2 text-[13px] font-medium disabled:opacity-50"
                      >
                        Salvar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
