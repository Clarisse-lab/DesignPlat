"use client";

// Desempenho por cliente: o que funciona no Instagram (formatos, estilos feitos aqui, capa animada)
// e os melhores carrosséis. Nota = salvamentos + compartilhamentos por mil de alcance.

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useStudioClients } from "@/components/editor/ClientPanel";

interface Grupo {
  nome: string;
  posts: number;
  nota: number | null;
  vs_mediana: number | null;
}
interface Resumo {
  mediana: number | null;
  total_posts: number;
  ligadas_agora: number;
  formatos: { tipo: string; posts: number; alcance: number | null; nota: number | null }[];
  estilos: Grupo[];
  capa: Grupo[];
  publicadas: { peca_id: string; titulo: string; estilo: string; capa_animada: boolean; vinculo: string | null; permalink: string | null; publicado_em: string; alcance: number | null; nota: number | null }[];
  melhores: { media_id: string; permalink: string | null; publicado_em: string; legenda: string; alcance: number | null; salvamentos: number | null; compartilhamentos: number | null; nota: number | null; peca: { id: string; estilo: string | null } | null }[];
  pendentes: { id: string; titulo: string; criado_em: string }[];
  livres: { media_id: string; publicado_em: string; legenda: string }[];
}

const day = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const n = (x: number | null | undefined) => (x === null || x === undefined ? "–" : x.toLocaleString("pt-BR"));

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div>
        <h2 className="text-[15px] font-bold">{title}</h2>
        {hint && <p className="text-[12.5px] text-ink-soft">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Groups({ list, empty }: { list: Grupo[]; empty: string }) {
  if (!list.length) return <p className="text-[13px] text-ink-faint">{empty}</p>;
  return (
    <table className="w-full text-[13px]">
      <thead className="text-left text-[12px] text-ink-faint">
        <tr>
          <th className="py-1 font-medium"></th>
          <th className="py-1 text-right font-medium">Posts</th>
          <th className="py-1 text-right font-medium">Nota</th>
          <th className="py-1 text-right font-medium">vs. mediana</th>
        </tr>
      </thead>
      <tbody>
        {list.map((g) => (
          <tr key={g.nome} className="border-t border-line">
            <td className="py-1.5 font-medium">{g.nome}</td>
            <td className="py-1.5 text-right tabular-nums">{g.posts}</td>
            <td className="py-1.5 text-right tabular-nums">{n(g.nota)}</td>
            <td className={`py-1.5 text-right tabular-nums ${g.vs_mediana === null ? "" : g.vs_mediana >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-danger"}`}>
              {g.vs_mediana === null ? "–" : `${g.vs_mediana > 0 ? "+" : ""}${g.vs_mediana}%`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DesempenhoPage() {
  const { clients } = useStudioClients();
  const [cliente, setCliente] = useState("");
  const [data, setData] = useState<Resumo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (slug: string) => {
    if (!slug) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/estudio/desempenho?cliente=${slug}`);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Erro ao carregar.");
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Abre no cliente do link (?cliente=, vindo da ficha do Escritório) ou no primeiro da lista.
    if (cliente || !clients?.length) return;
    const pedido = new URLSearchParams(window.location.search).get("cliente");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCliente(clients.some((c) => c.slug === pedido) ? (pedido as string) : clients[0].slug);
  }, [clients, cliente]);
  useEffect(() => {
    void load(cliente);
  }, [cliente, load]);

  const link = async (peca_id: string, media_id: string | null) => {
    const response = await fetch("/api/estudio/desempenho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peca_id, media_id }),
    });
    if (!response.ok) setError("Não foi possível ligar a peça ao post.");
    await load(cliente);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold">Desempenho</h1>
          <p className="text-[13px] text-ink-soft">
            <strong>Nota</strong> = salvamentos + compartilhamentos a cada mil pessoas alcançadas (o sinal de conteúdo que vale guardar). Últimos 120 dias.
          </p>
        </div>
        <select value={cliente} onChange={(e) => setCliente(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-[14px]">
          {(clients ?? []).map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-[13px] text-danger">{error}</p>}
      {loading && !data && (
        <div className="grid min-h-[30vh] place-items-center text-ink-soft">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      )}

      {data && (
        <div className={`space-y-5 ${loading ? "opacity-60" : ""}`}>
          <p className="text-[13px] text-ink-soft">
            {data.total_posts} posts no período · nota mediana do cliente: <strong>{n(data.mediana)}</strong>
            {data.ligadas_agora ? ` · ${data.ligadas_agora} peça(s) ligada(s) ao post publicado agora` : ""}
          </p>

          <div className="grid gap-5 md:grid-cols-2">
            <Card title="Formatos" hint="Carrossel, Reels e foto: alcance médio e nota.">
              <table className="w-full text-[13px]">
                <thead className="text-left text-[12px] text-ink-faint">
                  <tr>
                    <th className="py-1 font-medium"></th>
                    <th className="py-1 text-right font-medium">Posts</th>
                    <th className="py-1 text-right font-medium">Alcance</th>
                    <th className="py-1 text-right font-medium">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {data.formatos.map((f) => (
                    <tr key={f.tipo} className="border-t border-line">
                      <td className="py-1.5 font-medium">{f.tipo}</td>
                      <td className="py-1.5 text-right tabular-nums">{f.posts}</td>
                      <td className="py-1.5 text-right tabular-nums">{n(f.alcance)}</td>
                      <td className="py-1.5 text-right tabular-nums">{n(f.nota)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card title="Estilos feitos aqui" hint="Peças da plataforma já publicadas, por estilo de referência.">
              <Groups list={data.estilos} empty="Nenhuma peça daqui publicada ainda. Elas entram sozinhas quando a legenda publicada for a mesma da peça, ou ligue à mão abaixo." />
              {data.capa.length > 1 && (
                <div className="pt-2">
                  <p className="pb-1 text-[12.5px] font-semibold text-ink-soft">Capa animada × parada</p>
                  <Groups list={data.capa} empty="" />
                </div>
              )}
            </Card>
          </div>

          <Card title="Melhores carrosséis" hint="Os de nota mais alta: bons para usar como referência de estilo e de assunto.">
            <div className="divide-y divide-line">
              {data.melhores.map((p) => (
                <div key={p.media_id} className="flex items-start justify-between gap-3 py-2 text-[13px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.legenda || "(sem legenda)"}</p>
                    <p className="text-[12px] text-ink-faint">
                      {day(p.publicado_em)} · alcance {n(p.alcance)} · {n(p.salvamentos)} salvos · {n(p.compartilhamentos)} compart.
                      {p.peca ? ` · feito aqui${p.peca.estilo ? ` (${p.peca.estilo})` : ""}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12.5px] font-semibold tabular-nums text-accent">{n(p.nota)}</span>
                    {p.permalink && (
                      <a href={p.permalink} target="_blank" rel="noreferrer" aria-label="Abrir no Instagram" className="text-ink-soft hover:text-ink">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {!data.melhores.length && <p className="py-2 text-[13px] text-ink-faint">Nenhum carrossel no período.</p>}
            </div>
          </Card>

          <Card title="Peças publicadas" hint="Ligue cada peça ao post que foi ao ar (a ligação automática usa a legenda).">
            <div className="divide-y divide-line text-[13px]">
              {data.publicadas.map((p) => (
                <div key={p.peca_id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.titulo}</p>
                    <p className="text-[12px] text-ink-faint">
                      {p.estilo}
                      {p.capa_animada ? " · capa animada" : ""} · publicado {day(p.publicado_em)} · {p.vinculo === "auto" ? "ligado pela legenda" : "ligado à mão"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12.5px] font-semibold tabular-nums text-accent">{n(p.nota)}</span>
                    <button type="button" onClick={() => link(p.peca_id, null)} className="text-[12px] text-ink-faint underline hover:text-ink">
                      desligar
                    </button>
                  </div>
                </div>
              ))}
              {data.pendentes.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.titulo}</p>
                    <p className="text-[12px] text-ink-faint">criada {day(p.criado_em)} · sem post ligado</p>
                  </div>
                  <select
                    defaultValue=""
                    onChange={(e) => e.target.value && void link(p.id, e.target.value)}
                    className="max-w-[18rem] rounded-lg border border-line bg-surface px-2 py-1.5 text-[12.5px]"
                  >
                    <option value="">Ligar ao post…</option>
                    {data.livres.map((post) => (
                      <option key={post.media_id} value={post.media_id}>
                        {day(post.publicado_em)} · {post.legenda || "(sem legenda)"}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              {!data.publicadas.length && !data.pendentes.length && <p className="py-2 text-ink-faint">Nenhuma peça deste cliente ainda.</p>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
