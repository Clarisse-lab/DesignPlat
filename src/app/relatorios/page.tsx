"use client";

// Relatórios semanais (equipe): escolhe o cliente e a semana, gera o rascunho (números + textos da IA),
// revisa, acrescenta tráfego e entregas, publica e manda o link fixo do cliente.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Eye, Loader2, MessageCircle, RefreshCw, Send, Sparkles, Undo2 } from "lucide-react";
import { periodo, RelatorioView } from "@/components/relatorio/RelatorioView";
import type { RelatorioSemana, RelatorioView as View, SecaoId, TextosSemana, TrafegoSemana } from "@/lib/relatorio/tipos";

interface ClienteLinha {
  slug: string;
  nome: string;
  status: "rascunho" | "publicado" | null;
  visualizacoes: number;
}
interface SemanaLinha {
  inicio: string;
  fim: string;
  id: string | null;
  status: "rascunho" | "publicado" | null;
  visualizacoes: number;
}

const input = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13.5px] outline-none focus:border-line-strong";
const SECOES: [SecaoId, string][] = [
  ["numeros", "Números"],
  ["destaques", "Destaques"],
  ["conteudos", "Melhores conteúdos"],
  ["grafico", "Gráfico de alcance"],
  ["leads", "Leads"],
  ["trafego", "Tráfego pago"],
  ["entregas", "Entregas"],
  ["proximos", "Próximos passos"],
];
const CAMPOS_TRAFEGO: [keyof TrafegoSemana, string][] = [
  ["investimento", "Investimento (R$)"],
  ["leads", "Leads"],
  ["cpl", "Custo por lead (R$)"],
  ["vendas", "Vendas"],
  ["faturamento", "Faturamento (R$)"],
  ["roas", "ROAS"],
];
const curto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** "1.234,56" ou "1234.56" → número; vazio → null. */
function paraNumero(texto: string): number | null {
  const t = texto.trim().replace(/[R$\sx]/gi, "");
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = Number(normal);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
const paraTexto = (n: number | null | undefined) => (n === null || n === undefined ? "" : n.toLocaleString("pt-BR"));

function Status({ status, vistas }: { status: "rascunho" | "publicado" | null; vistas?: number }) {
  if (!status) return <span className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-ink-faint">sem relatório</span>;
  if (status === "rascunho") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">rascunho</span>;
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
      publicado{vistas ? ` · ${vistas} ${vistas === 1 ? "visita" : "visitas"}` : ""}
    </span>
  );
}

function Bloco({ titulo, dica, children }: { titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5 rounded-2xl border border-line bg-surface p-4">
      <div>
        <h3 className="text-[13.5px] font-bold">{titulo}</h3>
        {dica && <p className="text-[12px] text-ink-soft">{dica}</p>}
      </div>
      {children}
    </section>
  );
}

export default function RelatoriosPage() {
  const [clientes, setClientes] = useState<ClienteLinha[] | null>(null);
  const [semanaRef, setSemanaRef] = useState<{ inicio: string; fim: string } | null>(null);
  const [cliente, setCliente] = useState<string>("");
  const [semanas, setSemanas] = useState<SemanaLinha[]>([]);
  const [semana, setSemana] = useState<string>("");
  const [token, setToken] = useState("");
  const [rel, setRel] = useState<RelatorioSemana | null>(null);
  const [capas, setCapas] = useState<Record<string, string>>({});
  const [nome, setNome] = useState("");
  const [trafegoTxt, setTrafegoTxt] = useState<Record<string, string>>({});
  const [sujo, setSujo] = useState(false);
  const [ocupado, setOcupado] = useState<"" | "gerar" | "salvar" | "reescrever" | "todos">("");
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [progresso, setProgresso] = useState("");
  const [copiado, setCopiado] = useState(false);

  const linkCliente = token && typeof window !== "undefined" ? `${window.location.origin}/r/${token}` : "";

  const carregarClientes = useCallback(async () => {
    const r = await fetch("/api/estudio/relatorios");
    const body = await r.json().catch(() => ({}));
    if (!r.ok) {
      setAviso({ tipo: "erro", texto: body.error ?? "Não foi possível carregar os clientes." });
      setClientes([]);
      return;
    }
    setClientes(body.clientes);
    setSemanaRef(body.semana);
  }, []);

  useEffect(() => {
    carregarClientes();
  }, [carregarClientes]);

  const abrir = useCallback(async (id: string) => {
    const r = await fetch(`/api/estudio/relatorios/${id}`);
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error ?? "Não foi possível abrir o relatório.");
    setRel(body.relatorio);
    setCapas(body.capas ?? {});
    setNome(body.cliente);
    setToken(body.token);
    setTrafegoTxt(Object.fromEntries(CAMPOS_TRAFEGO.map(([k]) => [k, paraTexto(body.relatorio.trafego?.[k] as number | null)])));
    setSujo(false);
  }, []);

  const carregarSemanas = useCallback(
    async (slug: string, escolher?: string) => {
      const r = await fetch(`/api/estudio/relatorios?cliente=${slug}`);
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Não foi possível carregar as semanas.");
      setSemanas(body.semanas);
      setToken(body.token);
      const alvo = (body.semanas as SemanaLinha[]).find((s) => s.inicio === escolher) ?? body.semanas[0];
      setSemana(alvo.inicio);
      if (alvo.id) await abrir(alvo.id);
      else {
        setRel(null);
        setCapas({});
      }
    },
    [abrir],
  );

  async function trocarCliente(slug: string) {
    if (sujo && !confirm("Há alterações não salvas. Trocar de cliente mesmo assim?")) return;
    setCliente(slug);
    setRel(null);
    setAviso(null);
    if (!slug) return;
    setNome(clientes?.find((c) => c.slug === slug)?.nome ?? slug);
    await carregarSemanas(slug).catch((e) => setAviso({ tipo: "erro", texto: e.message }));
  }

  async function trocarSemana(inicio: string) {
    if (sujo && !confirm("Há alterações não salvas. Trocar de semana mesmo assim?")) return;
    setSemana(inicio);
    setAviso(null);
    const s = semanas.find((x) => x.inicio === inicio);
    if (s?.id) await abrir(s.id).catch((e) => setAviso({ tipo: "erro", texto: e.message }));
    else {
      setRel(null);
      setCapas({});
    }
  }

  async function gerar(slug = cliente, inicio = semana, notas = rel?.notas ?? null) {
    const r = await fetch("/api/estudio/relatorios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cliente: slug, semana_inicio: inicio, notas }),
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body.error ?? "Não foi possível gerar o relatório.");
    return body as { relatorio: RelatorioSemana; capas: Record<string, string>; custo_usd: number };
  }

  async function gerarAtual() {
    if (rel && sujo && !confirm("Gerar de novo atualiza os números e reescreve os textos. As edições de texto não salvas se perdem. Continuar?")) return;
    setOcupado("gerar");
    setAviso(null);
    try {
      const out = await gerar();
      await carregarSemanas(cliente, semana);
      setAviso({ tipo: "ok", texto: `Rascunho pronto (custo da IA: US$ ${out.custo_usd.toFixed(3)}). Revise e publique.` });
      carregarClientes();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao gerar." });
    } finally {
      setOcupado("");
    }
  }

  async function gerarTodos() {
    if (!clientes || !semanaRef) return;
    const pendentes = clientes.filter((c) => !c.status);
    if (!pendentes.length) return setAviso({ tipo: "ok", texto: "Todos os clientes já têm relatório desta semana." });
    if (!confirm(`Gerar o rascunho de ${pendentes.length} cliente(s) da semana de ${curto(semanaRef.inicio)} a ${curto(semanaRef.fim)}?`)) return;
    setOcupado("todos");
    setAviso(null);
    let ok = 0;
    const falhas: string[] = [];
    for (const [i, c] of pendentes.entries()) {
      setProgresso(`${i + 1} de ${pendentes.length}: ${c.nome}`);
      try {
        await gerar(c.slug, semanaRef.inicio, null);
        ok++;
      } catch (e) {
        falhas.push(`${c.nome} (${e instanceof Error ? e.message : "erro"})`);
      }
    }
    setProgresso("");
    setOcupado("");
    await carregarClientes();
    if (cliente) await carregarSemanas(cliente, semana).catch(() => null);
    setAviso({ tipo: falhas.length ? "erro" : "ok", texto: `${ok} rascunho(s) gerado(s).${falhas.length ? ` Falharam: ${falhas.join("; ")}` : ""}` });
  }

  function editar(campos: Partial<RelatorioSemana>) {
    if (!rel) return;
    setRel({ ...rel, ...campos });
    setSujo(true);
  }
  function editarTextos(campos: Partial<TextosSemana>) {
    if (!rel) return;
    editar({ textos: { ...rel.textos, ...campos } });
  }

  async function salvar(status?: "rascunho" | "publicado") {
    if (!rel) return;
    setOcupado("salvar");
    setAviso(null);
    const trafego: TrafegoSemana = { observacao: rel.trafego?.observacao?.trim() || null };
    for (const [k] of CAMPOS_TRAFEGO) (trafego as Record<string, number | null | string>)[k] = paraNumero(trafegoTxt[k] ?? "");
    try {
      const r = await fetch(`/api/estudio/relatorios/${rel.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          textos: {
            ...rel.textos,
            destaques: rel.textos.destaques.filter((d) => d.titulo.trim() || d.texto.trim()),
            proximos: rel.textos.proximos.map((p) => p.trim()).filter(Boolean),
          },
          trafego,
          entregas: rel.entregas.map((e) => e.trim()).filter(Boolean),
          secoes: rel.secoes ?? {},
          notas: rel.notas,
          ...(status ? { status } : {}),
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Não foi possível salvar.");
      setRel(body.relatorio);
      setSujo(false);
      if (status === "publicado") {
        await navigator.clipboard?.writeText(linkCliente).catch(() => null);
        setAviso({ tipo: "ok", texto: "Publicado. O link do cliente já mostra esta semana (link copiado)." });
      } else setAviso({ tipo: "ok", texto: status === "rascunho" ? "Voltou para rascunho: o cliente não vê mais esta semana." : "Salvo." });
      setSemanas((lista) => lista.map((s) => (s.inicio === rel.semana_inicio ? { ...s, status: body.relatorio.status } : s)));
      carregarClientes();
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao salvar." });
    } finally {
      setOcupado("");
    }
  }

  async function reescrever() {
    if (!rel) return;
    if (sujo) await salvar();
    setOcupado("reescrever");
    setAviso(null);
    try {
      const r = await fetch(`/api/estudio/relatorios/${rel.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "reescrever" }) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? "Não foi possível reescrever.");
      setRel(body.relatorio);
      setAviso({ tipo: "ok", texto: `Textos reescritos (custo da IA: US$ ${Number(body.custo_usd).toFixed(3)}).` });
    } catch (e) {
      setAviso({ tipo: "erro", texto: e instanceof Error ? e.message : "Erro ao reescrever." });
    } finally {
      setOcupado("");
    }
  }

  const previa: View | null = useMemo(() => {
    if (!rel) return null;
    const trafego: TrafegoSemana = { observacao: rel.trafego?.observacao ?? null };
    for (const [k] of CAMPOS_TRAFEGO) (trafego as Record<string, number | null | string>)[k] = paraNumero(trafegoTxt[k] ?? "");
    return {
      cliente: { nome, foto: rel.dados.foto_perfil ? (capas[rel.dados.foto_perfil] ?? null) : null },
      semana: { semana_inicio: rel.semana_inicio, semana_fim: rel.semana_fim, dados: rel.dados, textos: rel.textos, trafego, entregas: rel.entregas, secoes: rel.secoes ?? {} },
      capas,
    };
  }, [rel, capas, nome, trafegoTxt]);

  const mensagem = `Olá! O relatório da semana de ${semana ? periodo(semana, semanas.find((s) => s.inicio === semana)?.fim ?? semana) : ""} já está no ar: ${linkCliente}`;
  const atual = semanas.find((s) => s.inicio === semana);
  const destaques = rel ? [...rel.textos.destaques, ...Array.from({ length: Math.max(0, 3 - rel.textos.destaques.length) }, () => ({ titulo: "", texto: "" }))] : [];

  return (
    <div className="mx-auto max-w-[1540px] space-y-5 px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[.17em] text-ink-soft">Relatórios semanais</p>
          <h1 className="mt-1 text-[34px] font-normal leading-none tracking-tight">A semana de cada cliente</h1>
          <p className="mt-2 max-w-2xl text-[13px] text-ink-soft">
            Gere o rascunho, revise os textos, acrescente tráfego e entregas e publique. Cada cliente tem um link fixo que sempre mostra a semana mais recente.
          </p>
        </div>
        {semanaRef && (
          <button
            type="button"
            onClick={gerarTodos}
            disabled={!!ocupado}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--mosaic-action)] px-4 py-2.5 text-[13px] font-semibold text-[var(--mosaic-action-text)] disabled:opacity-50"
          >
            {ocupado === "todos" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {ocupado === "todos" ? progresso || "Gerando…" : `Gerar rascunhos de ${curto(semanaRef.inicio)} a ${curto(semanaRef.fim)}`}
          </button>
        )}
      </div>

      {clientes === null ? (
        <p className="flex items-center gap-2 text-[13px] text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando clientes…
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {clientes.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => trocarCliente(c.slug)}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] transition ${cliente === c.slug ? "border-ink bg-ink text-surface" : "border-line bg-surface hover:border-line-strong"}`}
            >
              {c.nome}
              <Status status={c.status} vistas={c.visualizacoes} />
            </button>
          ))}
        </div>
      )}

      {aviso && (
        <p className={`rounded-xl px-4 py-2.5 text-[13px] ${aviso.tipo === "erro" ? "bg-orange-50 text-danger" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"}`}>{aviso.texto}</p>
      )}

      {cliente && (
        <div className="grid items-start gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-1">
            <Bloco titulo="Semana">
              <select value={semana} onChange={(e) => trocarSemana(e.target.value)} className={input}>
                {semanas.map((s) => (
                  <option key={s.inicio} value={s.inicio}>
                    {curto(s.inicio)} a {curto(s.fim)} · {s.status ?? "sem relatório"}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-2">
                <Status status={atual?.status ?? null} vistas={atual?.visualizacoes} />
                {rel?.atualizado_por && <span className="text-[11.5px] text-ink-faint">editado por {rel.atualizado_por.split("@")[0]}</span>}
              </div>
              <button
                type="button"
                onClick={gerarAtual}
                disabled={!!ocupado}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] font-medium hover:border-line-strong disabled:opacity-50"
              >
                {ocupado === "gerar" ? <Loader2 className="h-4 w-4 animate-spin" /> : rel ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {ocupado === "gerar" ? "Coletando números e escrevendo…" : rel ? "Gerar de novo (números e textos)" : "Gerar o relatório desta semana"}
              </button>
            </Bloco>

            {rel && (
              <>
                <Bloco titulo="Link do cliente" dica="O mesmo link toda semana. Só mostra semanas publicadas.">
                  <div className="flex gap-2">
                    <input readOnly value={linkCliente} className={`${input} text-[12px]`} onFocus={(e) => e.target.select()} />
                    <button
                      type="button"
                      title="Copiar link"
                      onClick={async () => {
                        await navigator.clipboard?.writeText(linkCliente).catch(() => null);
                        setCopiado(true);
                        setTimeout(() => setCopiado(false), 1500);
                      }}
                      className="rounded-lg border border-line px-2.5 hover:border-line-strong"
                    >
                      {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <a href={linkCliente} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] hover:border-line-strong">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir
                    </a>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[12.5px] hover:border-line-strong"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                  </div>
                </Bloco>

                <Bloco titulo="Textos" dica="A IA escreve; você ajusta. Foque em resultado, não em tarefa.">
                  <label className="block space-y-1">
                    <span className="text-[12px] text-ink-soft">A semana em uma frase</span>
                    <input value={rel.textos.titulo} maxLength={140} onChange={(e) => editarTextos({ titulo: e.target.value })} className={input} />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[12px] text-ink-soft">Resumo</span>
                    <textarea value={rel.textos.resumo} rows={4} maxLength={1200} onChange={(e) => editarTextos({ resumo: e.target.value })} className={input} />
                  </label>
                  {destaques.slice(0, 3).map((d, i) => (
                    <div key={i} className="space-y-1.5 rounded-xl bg-canvas p-2.5">
                      <span className="text-[11.5px] text-ink-faint">Destaque {i + 1}</span>
                      <input
                        value={d.titulo}
                        maxLength={80}
                        placeholder="Título curto"
                        onChange={(e) => editarTextos({ destaques: destaques.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)) })}
                        className={input}
                      />
                      <textarea
                        value={d.texto}
                        rows={2}
                        maxLength={400}
                        placeholder="O número que sustenta"
                        onChange={(e) => editarTextos({ destaques: destaques.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })}
                        className={input}
                      />
                    </div>
                  ))}
                  <label className="block space-y-1">
                    <span className="text-[12px] text-ink-soft">Próximos passos (um por linha)</span>
                    <textarea value={rel.textos.proximos.join("\n")} rows={4} onChange={(e) => editarTextos({ proximos: e.target.value.split("\n") })} className={input} />
                  </label>
                </Bloco>

                <Bloco titulo="Contexto para a IA" dica="Interno: o cliente não vê. Ex.: semana de Black Friday, mudamos o horário dos posts.">
                  <textarea value={rel.notas ?? ""} rows={3} maxLength={3000} onChange={(e) => editar({ notas: e.target.value })} className={input} />
                  <button
                    type="button"
                    onClick={reescrever}
                    disabled={!!ocupado}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] hover:border-line-strong disabled:opacity-50"
                  >
                    {ocupado === "reescrever" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Reescrever os textos com isso
                  </button>
                </Bloco>

                <Bloco titulo="Tráfego pago" dica="Opcional. Deixe em branco o que não quiser mostrar.">
                  <div className="grid grid-cols-2 gap-2">
                    {CAMPOS_TRAFEGO.map(([k, rotulo]) => (
                      <label key={k} className="block space-y-1">
                        <span className="text-[11.5px] text-ink-soft">{rotulo}</span>
                        <input
                          inputMode="decimal"
                          value={trafegoTxt[k] ?? ""}
                          onChange={(e) => {
                            setTrafegoTxt({ ...trafegoTxt, [k]: e.target.value });
                            setSujo(true);
                          }}
                          className={input}
                        />
                      </label>
                    ))}
                  </div>
                  <textarea
                    value={rel.trafego?.observacao ?? ""}
                    rows={2}
                    maxLength={400}
                    placeholder="Observação (aparece para o cliente)"
                    onChange={(e) => editar({ trafego: { ...rel.trafego, observacao: e.target.value } })}
                    className={input}
                  />
                </Bloco>

                <Bloco titulo="Entregas" dica="Uma por linha. As peças aprovadas no link de aprovação já entram sozinhas.">
                  {rel.dados.aprovadas.length > 0 && (
                    <ul className="space-y-1 text-[12.5px] text-ink-soft">
                      {rel.dados.aprovadas.map((a, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5" /> {a.titulo}
                        </li>
                      ))}
                    </ul>
                  )}
                  <textarea
                    value={rel.entregas.join("\n")}
                    rows={4}
                    placeholder={"Página de captura da Black Friday\n12 criativos de anúncio"}
                    onChange={(e) => editar({ entregas: e.target.value.split("\n") })}
                    className={input}
                  />
                </Bloco>

                <Bloco titulo="Seções" dica="Desmarque o que não deve aparecer nesta semana.">
                  <div className="grid grid-cols-2 gap-1.5">
                    {SECOES.map(([id, rotulo]) => (
                      <label key={id} className="flex items-center gap-2 text-[12.5px]">
                        <input type="checkbox" checked={rel.secoes?.[id] !== false} onChange={(e) => editar({ secoes: { ...rel.secoes, [id]: e.target.checked } })} />
                        {rotulo}
                      </label>
                    ))}
                  </div>
                </Bloco>

                <div className="sticky bottom-0 flex gap-2 rounded-2xl border border-line bg-surface p-3">
                  <button
                    type="button"
                    onClick={() => salvar()}
                    disabled={!!ocupado || !sujo}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-line px-3 py-2.5 text-[13px] font-medium disabled:opacity-50"
                  >
                    {ocupado === "salvar" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {sujo ? "Salvar" : "Salvo"}
                  </button>
                  {rel.status === "publicado" ? (
                    <button
                      type="button"
                      onClick={() => salvar(sujo ? "publicado" : "rascunho")}
                      disabled={!!ocupado}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2.5 text-[13px] font-semibold text-surface disabled:opacity-50"
                    >
                      {sujo ? <Send className="h-4 w-4" /> : <Undo2 className="h-4 w-4" />}
                      {sujo ? "Salvar e manter no ar" : "Despublicar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => salvar("publicado")}
                      disabled={!!ocupado}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--mosaic-action)] px-3 py-2.5 text-[13px] font-semibold text-[var(--mosaic-action-text)] disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" /> Publicar
                    </button>
                  )}
                </div>
              </>
            )}
          </aside>

          <div className="min-w-0 overflow-hidden rounded-[26px] border border-line">
            {previa ? (
              <>
                <p className="flex items-center gap-2 bg-surface px-4 py-2 text-[12px] text-ink-soft">
                  <Eye className="h-3.5 w-3.5" /> Prévia: é assim que o cliente vê{rel?.status !== "publicado" ? " depois de publicar" : ""}.
                </p>
                <RelatorioView key={`${rel?.id}-${rel?.atualizado_em}`} view={previa} />
              </>
            ) : (
              <div className="grid min-h-[420px] place-items-center bg-surface p-8 text-center text-[13.5px] text-ink-soft">
                {ocupado === "gerar" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Coletando os números da semana e escrevendo o resumo…
                  </span>
                ) : (
                  "Ainda não há relatório desta semana. Clique em “Gerar o relatório desta semana”."
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
