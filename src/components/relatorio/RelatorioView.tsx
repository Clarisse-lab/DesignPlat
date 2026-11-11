"use client";

// Apresentação semanal do cliente: a mesma tela no link do cliente (/r/<token>) e na prévia da aba Relatórios.
// Seções aparecem com a rolagem, números contam até o valor, gráficos se desenham. Sem dependências além do React,
// e respeita "reduzir movimento" do sistema. Imprime (Baixar PDF) com uma seção por bloco.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { variacao } from "@/lib/relatorio/calc";
import type { Kpi, PostSemana, RelatorioView as View, SecaoId } from "@/lib/relatorio/tipos";
import "./relatorio.css";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const dia = (d: string) => Number(d.slice(8, 10));
const mes = (d: string) => MESES[Number(d.slice(5, 7)) - 1];

export function periodo(inicio: string, fim: string): string {
  const ano = fim.slice(0, 4);
  if (inicio.slice(5, 7) === fim.slice(5, 7)) return `${dia(inicio)} a ${dia(fim)} de ${mes(fim)} de ${ano}`;
  return `${dia(inicio)} de ${mes(inicio)} a ${dia(fim)} de ${mes(fim)} de ${ano}`;
}
const curtoData = (d: string) => `${String(dia(d)).padStart(2, "0")}/${d.slice(5, 7)}`;

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
export const fmtNumero = (n: number) => (Math.abs(n) >= 10_000 ? compacto.format(n) : inteiro.format(n));

const reduzido = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Marca o elemento como visível quando entra na tela (uma vez). */
function useReveal<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduzido() || typeof IntersectionObserver === "undefined") {
      setVisivel(true);
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setVisivel(true);
          io.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    const imprimir = () => setVisivel(true);
    window.addEventListener("beforeprint", imprimir);
    return () => {
      io.disconnect();
      window.removeEventListener("beforeprint", imprimir);
    };
  }, []);
  return [ref, visivel];
}

/** Número que conta até o valor quando aparece. */
function Contador({ valor, ativo, formato = fmtNumero, duracao = 1500 }: { valor: number; ativo: boolean; formato?: (n: number) => string; duracao?: number }) {
  const [atual, setAtual] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    if (reduzido()) {
      setAtual(valor);
      return;
    }
    let frame = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / duracao);
      const e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // easeOutExpo
      setAtual(valor * e);
      if (p < 1) frame = requestAnimationFrame(passo);
    };
    frame = requestAnimationFrame(passo);
    const imprimir = () => {
      cancelAnimationFrame(frame);
      setAtual(valor);
    };
    window.addEventListener("beforeprint", imprimir);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("beforeprint", imprimir);
    };
  }, [valor, ativo, duracao]);
  const mostrado = Number.isInteger(valor) ? Math.round(atual) : atual;
  // Na impressão (Baixar PDF) aparece sempre o valor final, sem depender da animação.
  return (
    <span className="rs-num">
      <span className="rs-num-tela">
        <ComUnidade texto={formato(mostrado)} />
      </span>
      <span className="rs-num-print" aria-hidden="true">
        <ComUnidade texto={formato(valor)} />
      </span>
    </span>
  );
}

/** "12,4 mil" com a unidade menor. */
function ComUnidade({ texto }: { texto: string }) {
  const m = /^(.*\d)\s?(mil|mi|bi)$/.exec(texto);
  if (!m) return <>{texto}</>;
  return (
    <>
      {m[1]}
      <small className="rs-unid">{m[2]}</small>
    </>
  );
}

function Variacao({ k, inverso = false, neutro = false }: { k: Kpi; inverso?: boolean; neutro?: boolean }) {
  const v = variacao(k);
  if (v === null) return <span className="rs-delta rs-delta-neutro">primeira semana medida</span>;
  if (v === 0) return <span className="rs-delta rs-delta-neutro">igual à semana anterior</span>;
  const bom = inverso ? v < 0 : v > 0;
  return (
    <span className={`rs-delta ${neutro ? "rs-delta-neutro" : bom ? "rs-delta-sobe" : "rs-delta-desce"}`}>
      <svg viewBox="0 0 12 12" aria-hidden="true" className={v > 0 ? "" : "rs-seta-baixo"}>
        <path d="M6 2.5 10 8H2z" fill="currentColor" />
      </svg>
      {`${v > 0 ? "+" : ""}${decimal.format(v)}%`}
      <em>vs. semana anterior</em>
    </span>
  );
}

function Secao({ id, eyebrow, titulo, children, escura = false }: { id: string; eyebrow: string; titulo?: string; children: React.ReactNode; escura?: boolean }) {
  const [ref, visivel] = useReveal<HTMLElement>();
  return (
    <section ref={ref} id={id} className={`rs-secao ${escura ? "rs-escura" : ""} ${visivel ? "is-in" : ""}`}>
      <div className="rs-container">
        <header className="rs-secao-topo">
          <p className="rs-eyebrow">{eyebrow}</p>
          {titulo && <h2 className="rs-h2">{titulo}</h2>}
        </header>
        {children}
      </div>
    </section>
  );
}

function KpiCard({ rotulo, k, detalhe, ativo, ordem, destaque = false, neutro = false }: { rotulo: string; k: Kpi; detalhe?: string; ativo: boolean; ordem: number; destaque?: boolean; neutro?: boolean }) {
  if (k.valor === null) return null;
  return (
    <article className={`rs-kpi ${destaque ? "rs-kpi-destaque" : ""}`} style={{ "--i": ordem } as React.CSSProperties}>
      <p className="rs-kpi-rotulo">{rotulo}</p>
      <p className="rs-kpi-valor">
        <Contador valor={k.valor} ativo={ativo} formato={(n) => `${k.valor !== null && k.valor > 0 && rotulo.startsWith("Novos") ? "+" : ""}${fmtNumero(n)}`} />
      </p>
      <Variacao k={k} neutro={neutro} />
      {detalhe && <p className="rs-kpi-detalhe">{detalhe}</p>}
    </article>
  );
}

const PLURAL: Record<string, string> = { Reels: "reels", Carrossel: "carrosséis", Foto: "fotos", Vídeo: "vídeos" };
const plural = (formato: string, n: number) => (n === 1 ? formato.toLowerCase() : (PLURAL[formato] ?? formato.toLowerCase()));
const COR: Record<string, string> = { Reels: "#704bfd", Carrossel: "#40095b", Foto: "#b89aff", Vídeo: "#d0aee4" };
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaSemana = (iso: string) => DIAS[new Date(new Date(iso).getTime() - 3 * 3600_000).getUTCDay()];

function Numeros({ view }: { view: View }) {
  const [ref, ativo] = useReveal<HTMLDivElement>();
  const ig = view.semana.dados.instagram;
  const leads = view.semana.dados.leads;
  if (!ig && !leads) return null;
  type Card = { rotulo: string; k: Kpi; detalhe?: string; destaque?: boolean; neutro?: boolean };
  const cards: Card[] = [];
  if (ig) {
    cards.push(
      { rotulo: "Alcance", k: ig.alcance, detalhe: "pessoas alcançadas pelos posts da semana", destaque: true },
      { rotulo: "Interações", k: ig.interacoes, detalhe: "curtidas, comentários, salvamentos e compartilhamentos" },
      { rotulo: "Novos seguidores", k: ig.novos_seguidores, detalhe: ig.seguidores ? `${fmtNumero(ig.seguidores)} no total` : undefined },
      { rotulo: "Salvos e compartilhados", k: ig.salvos_compart, detalhe: "o sinal de conteúdo que as pessoas querem guardar" },
      { rotulo: "Publicações", k: ig.posts, neutro: true, detalhe: ig.formatos.map((f) => `${f.posts} ${plural(f.formato, f.posts)}`).join(" · ") || undefined },
    );
  }
  if (leads) cards.push({ rotulo: "Leads", k: leads.total, detalhe: "contatos novos que chegaram pelas páginas" });
  const visiveis = cards.filter((c) => c.k.valor !== null);
  return (
    <div ref={ref} className={`rs-kpis ${ativo ? "is-in" : ""}`}>
      {visiveis.map((c, i) => (
        <KpiCard key={c.rotulo} {...c} ativo={ativo} ordem={i} />
      ))}
    </div>
  );
}

function CapaPost({ post, capas }: { post: PostSemana; capas: Record<string, string> }) {
  const url = post.capa ? capas[post.capa] : null;
  if (url) return <img src={url} alt="" loading="lazy" className="rs-capa-img" />;
  return (
    <div className="rs-capa-vazia" style={{ background: `linear-gradient(140deg, ${COR[post.formato] ?? "#40095b"}, #24002f)` }}>
      <span>{post.formato}</span>
    </div>
  );
}

function Melhores({ view }: { view: View }) {
  const ig = view.semana.dados.instagram;
  if (!ig) return null;
  const posts = ig.melhores.map((id) => ig.lista.find((p) => p.media_id === id)).filter((p): p is PostSemana => Boolean(p));
  if (!posts.length) return null;
  return (
    <div className="rs-posts">
      {posts.map((p, i) => {
        const estilo = { "--i": i } as React.CSSProperties;
        const conteudo = (
          <>
            <div className="rs-post-capa">
              <CapaPost post={p} capas={view.capas} />
              <span className="rs-post-pos">{String(i + 1).padStart(2, "0")}</span>
              <span className="rs-post-formato">{p.formato}</span>
            </div>
            <div className="rs-post-corpo">
              <p className="rs-post-data">
                {diaSemana(p.publicado_em)}, {curtoData(new Date(new Date(p.publicado_em).getTime() - 3 * 3600_000).toISOString().slice(0, 10))}
              </p>
              <p className="rs-post-legenda">{p.legenda || "Sem legenda"}</p>
              <dl className="rs-post-metricas">
                {p.alcance !== null && (
                  <div>
                    <dt>Alcance</dt>
                    <dd>{fmtNumero(p.alcance)}</dd>
                  </div>
                )}
                {p.interacoes !== null && (
                  <div>
                    <dt>Interações</dt>
                    <dd>{fmtNumero(p.interacoes)}</dd>
                  </div>
                )}
                {(p.salvamentos !== null || p.compartilhamentos !== null) && (
                  <div>
                    <dt>Salvos + compart.</dt>
                    <dd>{fmtNumero((p.salvamentos ?? 0) + (p.compartilhamentos ?? 0))}</dd>
                  </div>
                )}
              </dl>
            </div>
          </>
        );
        return p.permalink ? (
          <a key={p.media_id} className="rs-post" style={estilo} href={p.permalink} target="_blank" rel="noreferrer">
            {conteudo}
          </a>
        ) : (
          <div key={p.media_id} className="rs-post" style={estilo}>
            {conteudo}
          </div>
        );
      })}
    </div>
  );
}

function Grafico({ view }: { view: View }) {
  const [ref, ativo] = useReveal<HTMLDivElement>();
  const ig = view.semana.dados.instagram;
  const inicio = view.semana.semana_inicio;
  // Alcance por dia da semana (segunda a domingo), empilhado por formato.
  const dias = useMemo(() => {
    const base = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.parse(`${inicio}T12:00:00Z`) + i * 86_400_000);
      return { rotulo: DIAS[d.getUTCDay()], data: d.toISOString().slice(0, 10), total: 0, posts: 0, partes: new Map<string, number>() };
    });
    for (const p of ig?.lista ?? []) {
      if (p.alcance === null) continue;
      const local = new Date(new Date(p.publicado_em).getTime() - 3 * 3600_000).toISOString().slice(0, 10);
      const dia = base.find((d) => d.data === local);
      if (!dia) continue;
      dia.total += p.alcance;
      dia.posts++;
      dia.partes.set(p.formato, (dia.partes.get(p.formato) ?? 0) + p.alcance);
    }
    return base;
  }, [ig, inicio]);
  if (!ig || dias.filter((d) => d.posts > 0).length < 2) return null;
  const max = Math.max(...dias.map((d) => d.total), 1);
  const melhorDia = dias.reduce((a, b) => (b.total > a.total ? b : a));
  const totalAlcance = ig.formatos.reduce((s, f) => s + f.alcance, 0) || 1;
  const R = 54;
  const C = 2 * Math.PI * R;
  let acumulado = 0;
  return (
    <div ref={ref} className={`rs-grafico ${ativo ? "is-in" : ""}`}>
      <div className="rs-barras-caixa">
        <p className="rs-barras-titulo">
          Alcance por dia de publicação · melhor dia: <strong>{melhorDia.rotulo}</strong>
        </p>
        <div className="rs-barras" role="img" aria-label="Alcance das publicações por dia da semana">
          {dias.map((d, i) => (
            <div key={d.data} className={`rs-barra-col ${d === melhorDia ? "rs-barra-top" : ""}`} style={{ "--i": i } as React.CSSProperties}>
              <div className="rs-barra-trilho">
                <span className="rs-barra-valor">{d.total ? fmtNumero(d.total) : "–"}</span>
                <div className="rs-barra" style={{ height: `${d.total ? Math.max(2, (d.total / max) * 100) : 0}%` }} title={`${d.posts} publicação(ões) · ${fmtNumero(d.total)} de alcance`}>
                  {[...d.partes.entries()].map(([f, v]) => (
                    <span key={f} style={{ flexGrow: v, background: COR[f] ?? "#40095b" }} />
                  ))}
                </div>
              </div>
              <span className="rs-barra-dia">{d.rotulo}</span>
              <span className="rs-barra-posts">{d.posts ? `${d.posts} ${d.posts === 1 ? "post" : "posts"}` : ""}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rs-rosca">
        <svg viewBox="0 0 140 140" aria-hidden="true">
          <circle cx="70" cy="70" r={R} className="rs-rosca-fundo" />
          {ig.formatos.map((f) => {
            const parte = (f.alcance / totalAlcance) * C;
            const el = (
              <circle
                key={f.formato}
                cx="70"
                cy="70"
                r={R}
                className="rs-rosca-parte"
                stroke={COR[f.formato] ?? "#40095b"}
                strokeDasharray={`${ativo ? Math.max(0, parte - 3) : 0} ${C}`}
                strokeDashoffset={-acumulado}
              />
            );
            acumulado += parte;
            return el;
          })}
        </svg>
        <div className="rs-rosca-centro">
          <strong>{fmtNumero(totalAlcance)}</strong>
          <span>por formato</span>
        </div>
        <ul className="rs-legenda">
          {ig.formatos.map((f) => (
            <li key={f.formato}>
              <i style={{ background: COR[f.formato] ?? "#40095b" }} />
              {f.formato}
              <em>{f.posts} {f.posts === 1 ? "post" : "posts"}</em>
              <span>{Math.round((f.alcance / totalAlcance) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Leads({ view }: { view: View }) {
  const [ref, ativo] = useReveal<HTMLDivElement>();
  const leads = view.semana.dados.leads;
  if (!leads || leads.total.valor === null) return null;
  const max = Math.max(1, ...leads.origens.map((o) => o.total));
  return (
    <div ref={ref} className={`rs-leads ${ativo ? "is-in" : ""}`}>
      <div className="rs-leads-total">
        <p className="rs-kpi-valor rs-gigante">
          <Contador valor={leads.total.valor} ativo={ativo} />
        </p>
        <p className="rs-leads-rotulo">leads na semana</p>
        <Variacao k={leads.total} />
      </div>
      {leads.origens.length > 0 && (
        <ul className="rs-origens">
          {leads.origens.slice(0, 6).map((o, i) => (
            <li key={o.origem} style={{ "--i": i } as React.CSSProperties}>
              <span>{o.origem}</span>
              <div className="rs-origem-trilho">
                <div className="rs-origem-barra" style={{ width: `${(o.total / max) * 100}%` }} />
              </div>
              <strong>{inteiro.format(o.total)}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Trafego({ view }: { view: View }) {
  const [ref, ativo] = useReveal<HTMLDivElement>();
  const t = view.semana.trafego;
  const itens: { rotulo: string; valor: number; fmt: (n: number) => string }[] = [];
  if (t.investimento != null) itens.push({ rotulo: "Investimento", valor: t.investimento, fmt: (n) => moeda.format(n) });
  if (t.leads != null) itens.push({ rotulo: "Leads", valor: t.leads, fmt: (n) => inteiro.format(n) });
  if (t.cpl != null) itens.push({ rotulo: "Custo por lead", valor: t.cpl, fmt: (n) => moeda.format(n) });
  if (t.vendas != null) itens.push({ rotulo: "Vendas", valor: t.vendas, fmt: (n) => inteiro.format(n) });
  if (t.faturamento != null) itens.push({ rotulo: "Faturamento", valor: t.faturamento, fmt: (n) => moeda.format(n) });
  if (t.roas != null) itens.push({ rotulo: "Retorno (ROAS)", valor: t.roas, fmt: (n) => `${decimal.format(n)}x` });
  if (!itens.length && !t.observacao) return null;
  return (
    <div ref={ref} className={`rs-trafego ${ativo ? "is-in" : ""}`}>
      <div className="rs-trafego-grade">
        {itens.map((it, i) => (
          <div key={it.rotulo} className="rs-trafego-item" style={{ "--i": i } as React.CSSProperties}>
            <p>{it.rotulo}</p>
            <strong>
              <Contador valor={it.valor} ativo={ativo} formato={it.fmt} />
            </strong>
          </div>
        ))}
      </div>
      {t.observacao && <p className="rs-trafego-obs">{t.observacao}</p>}
    </div>
  );
}

function Entregas({ view }: { view: View }) {
  const lista = [...view.semana.dados.aprovadas.map((a) => `${a.titulo} (aprovado)`), ...view.semana.entregas];
  if (!lista.length) return null;
  return (
    <ul className="rs-entregas">
      {lista.map((e, i) => (
        <li key={`${e}-${i}`} style={{ "--i": i } as React.CSSProperties}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11" />
            <path d="M7 12.5l3.2 3.2L17 9" />
          </svg>
          <span>{e}</span>
        </li>
      ))}
    </ul>
  );
}

function Hero({ view, onSemana }: { view: View; onSemana?: (inicio: string) => void }) {
  const { cliente, semana } = view;
  const palavras = (semana.textos.titulo || "Relatório da semana").split(/\s+/);
  const iniciais = cliente.nome
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <header className="rs-hero">
      <div className="rs-orbe rs-orbe-1" />
      <div className="rs-orbe rs-orbe-2" />
      <div className="rs-orbe rs-orbe-3" />
      <div className="rs-grao" />
      <nav className="rs-topo rs-container">
        <span className="rs-marca">
          <span>
            mantora<sup>®</sup>
          </span>
          <small>relatório semanal</small>
        </span>
        <div className="rs-acoes">
          {view.semanas && view.semanas.length > 1 && onSemana && (
            <label className="rs-seletor">
              <span className="sr-only">Escolher semana</span>
              <select value={semana.semana_inicio} onChange={(e) => onSemana(e.target.value)}>
                {view.semanas.map((s) => (
                  <option key={s.inicio} value={s.inicio}>
                    {curtoData(s.inicio)} a {curtoData(s.fim)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className="rs-botao-pdf" onClick={() => window.print()}>
            Baixar PDF
          </button>
        </div>
      </nav>
      <div className="rs-hero-corpo rs-container">
        <div className="rs-cliente">
          <span className="rs-avatar">{cliente.foto ? <img src={cliente.foto} alt="" /> : <b>{iniciais || "·"}</b>}</span>
          <div>
            <p className="rs-cliente-nome">{cliente.nome}</p>
            <p className="rs-periodo">Semana de {periodo(semana.semana_inicio, semana.semana_fim)}</p>
          </div>
        </div>
        <h1 className="rs-titulo">
          {palavras.map((p, i) => (
            <Fragment key={i}>
              <span className="rs-palavra" style={{ "--i": i } as React.CSSProperties}>
                {p}
              </span>{" "}
            </Fragment>
          ))}
        </h1>
        {semana.textos.resumo && <p className="rs-resumo">{semana.textos.resumo}</p>}
      </div>
      <a className="rs-rolar" href="#numeros" aria-label="Ver os números">
        <span />
      </a>
    </header>
  );
}

export function RelatorioView({ view, onSemana }: { view: View; onSemana?: (inicio: string) => void }) {
  const { semana } = view;
  const ig = semana.dados.instagram;
  const mostra = (id: SecaoId) => semana.secoes?.[id] !== false;
  const destaques = semana.textos.destaques?.filter((d) => d.titulo || d.texto) ?? [];
  const proximos = semana.textos.proximos?.filter(Boolean) ?? [];
  const temTrafego = Object.entries(semana.trafego ?? {}).some(([, v]) => v !== null && v !== undefined && v !== "");
  const temEntregas = semana.dados.aprovadas.length + (semana.entregas?.length ?? 0) > 0;
  const temGrafico = (ig?.lista.filter((p) => p.alcance !== null).length ?? 0) >= 2;
  return (
    <div className="rs">
      <Hero view={view} onSemana={onSemana} />

      {mostra("numeros") && (ig || semana.dados.leads) && (
        <Secao id="numeros" eyebrow="Os números" titulo="Como a semana performou">
          <Numeros view={view} />
          {ig?.parcial && <p className="rs-nota">Números do Instagram parciais: a coleta desta semana ainda não foi feita.</p>}
        </Secao>
      )}

      {mostra("destaques") && destaques.length > 0 && (
        <Secao id="destaques" eyebrow="Destaques" titulo="O que mais chamou atenção">
          <div className="rs-destaques">
            {destaques.map((d, i) => (
              <article key={i} className="rs-destaque" style={{ "--i": i } as React.CSSProperties}>
                <span className="rs-destaque-n">{String(i + 1).padStart(2, "0")}</span>
                <h3>{d.titulo}</h3>
                <p>{d.texto}</p>
              </article>
            ))}
          </div>
        </Secao>
      )}

      {mostra("conteudos") && ig && ig.melhores.length > 0 && (
        <Secao id="conteudos" eyebrow="Conteúdos" titulo="Os melhores da semana">
          <Melhores view={view} />
        </Secao>
      )}

      {mostra("grafico") && temGrafico && (
        <Secao id="grafico" eyebrow="Alcance" titulo="Onde a semana rendeu mais">
          <Grafico view={view} />
        </Secao>
      )}

      {mostra("leads") && semana.dados.leads && semana.dados.leads.total.valor !== null && (
        <Secao id="leads" eyebrow="Captação" titulo="Leads que chegaram">
          <Leads view={view} />
        </Secao>
      )}

      {mostra("trafego") && temTrafego && (
        <Secao id="trafego" eyebrow="Tráfego pago" titulo="Investimento e retorno" escura>
          <Trafego view={view} />
        </Secao>
      )}

      {mostra("entregas") && temEntregas && (
        <Secao id="entregas" eyebrow="Entregas" titulo="O que entregamos">
          <Entregas view={view} />
        </Secao>
      )}

      {mostra("proximos") && proximos.length > 0 && (
        <Secao id="proximos" eyebrow="Próxima semana" titulo="Próximos passos">
          <ol className="rs-proximos">
            {proximos.map((p, i) => (
              <li key={i} style={{ "--i": i } as React.CSSProperties}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{p}</p>
              </li>
            ))}
          </ol>
        </Secao>
      )}

      <footer className="rs-rodape">
        <div className="rs-container">
          <span className="rs-marca rs-marca-rodape">
            mantora<sup>®</sup>
          </span>
          <p>
            Relatório preparado pela equipe Mantora Lab · {periodo(semana.semana_inicio, semana.semana_fim)}
            {ig?.medido_em ? ` · Instagram medido em ${curtoData(ig.medido_em)}` : ""}
          </p>
        </div>
      </footer>
    </div>
  );
}
