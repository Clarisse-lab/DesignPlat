"use client";

// Apresentação semanal do cliente: a mesma tela no link do cliente (/r/<token>) e na prévia da aba Relatórios.
// Seções aparecem com a rolagem, números contam até o valor, gráficos se desenham. Sem dependências além do React,
// e respeita "reduzir movimento" do sistema. Imprime (Baixar PDF) com uma seção por bloco.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { variacao } from "@/lib/relatorio/calc";
import { antesDepoisMelhorou, kpiDe, leitura, taxaEngajamento, type Tom } from "@/lib/relatorio/extras";
import { variaveisDoTema } from "@/lib/relatorio/tema";
import type { Kpi, Marco, PostSemana, RelatorioView as View, SecaoId, TipoPeriodo, TrafegoSemana } from "@/lib/relatorio/tipos";
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

/** Palavras do período: "semana" ou "mês". */
export function rotulos(tipo: TipoPeriodo | undefined) {
  return tipo === "mes"
    ? { nome: "mês", anterior: "mês anterior", deste: "deste mês", no: "no mês", titulo: "relatório mensal", primeira: "primeiro mês medido" }
    : { nome: "semana", anterior: "semana anterior", deste: "desta semana", no: "na semana", titulo: "relatório semanal", primeira: "primeira semana medida" };
}

/** "Semana de 2 a 8 de novembro de 2026" ou "Mês de novembro de 2026". */
export function nomePeriodo(tipo: TipoPeriodo | undefined, inicio: string, fim: string): string {
  if (tipo === "mes") return `${mes(inicio).replace(/^./, (c) => c.toUpperCase())} de ${inicio.slice(0, 4)}`;
  return `Semana de ${periodo(inicio, fim)}`;
}

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const moedaInteira = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
/** Valores grandes sem centavos (R$ 4.398), para caber no card; os centavos ficam em "Todos os números". */
const moedaCurta = (n: number) => (Math.abs(n) >= 1000 ? moedaInteira.format(n) : moeda.format(n));
export const fmtNumero = (n: number) => (Math.abs(n) >= 10_000 ? compacto.format(n) : inteiro.format(n));

const reduzido = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Marca o elemento como visível quando entra na tela (uma vez). */
/** Leads só aparecem quando chegou pelo menos um no período (com zero, a parte de leads some). */
const leadsDe = (d: View["semana"]["dados"]) => (d.leads && (d.leads.total.valor ?? 0) > 0 ? d.leads : null);

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

function Variacao({ k, tipo, inverso = false, neutro = false }: { k: Kpi; tipo?: TipoPeriodo; inverso?: boolean; neutro?: boolean }) {
  const r = rotulos(tipo);
  const v = variacao(k);
  if (v === null) return <span className="rs-delta rs-delta-neutro">{r.primeira}</span>;
  if (v === 0) return <span className="rs-delta rs-delta-neutro">igual {tipo === "mes" ? "ao" : "à"} {r.anterior}</span>;
  const bom = inverso ? v < 0 : v > 0;
  return (
    <span className={`rs-delta ${neutro ? "rs-delta-neutro" : bom ? "rs-delta-sobe" : "rs-delta-desce"}`}>
      <svg viewBox="0 0 12 12" aria-hidden="true" className={v > 0 ? "" : "rs-seta-baixo"}>
        <path d="M6 2.5 10 8H2z" fill="currentColor" />
      </svg>
      {`${v > 0 ? "+" : ""}${decimal.format(v)}%`}
      <em>vs. {r.anterior}</em>
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

function KpiCard({
  rotulo,
  k,
  detalhe,
  ativo,
  ordem,
  tipo,
  destaque = false,
  neutro = false,
  inverso = false,
  formato = fmtNumero,
  sinal = false,
  leitura,
}: {
  rotulo: string;
  k: Kpi;
  detalhe?: string;
  ativo: boolean;
  ordem: number;
  tipo?: TipoPeriodo;
  destaque?: boolean;
  neutro?: boolean;
  inverso?: boolean;
  formato?: (n: number) => string;
  /** Mostra "+" na frente (seguidores novos). */
  sinal?: boolean;
  leitura?: { tom: Tom; texto: string } | null;
}) {
  if (k.valor === null) return null;
  return (
    <article className={`rs-kpi ${destaque ? "rs-kpi-destaque" : ""}`} style={{ "--i": ordem } as React.CSSProperties}>
      <div className="rs-kpi-topo">
        <p className="rs-kpi-rotulo">{rotulo}</p>
        {leitura && <span className={`rs-leitura rs-leitura-${leitura.tom}`}>{leitura.texto}</span>}
      </div>
      <p className="rs-kpi-valor">
        <Contador valor={k.valor} ativo={ativo} formato={(n) => `${sinal && k.valor !== null && k.valor > 0 ? "+" : ""}${formato(n)}`} />
      </p>
      <Variacao k={k} neutro={neutro} tipo={tipo} inverso={inverso} />
      {detalhe && <p className="rs-kpi-detalhe">{detalhe}</p>}
    </article>
  );
}

const PLURAL: Record<string, string> = { Reels: "reels", Carrossel: "carrosséis", Foto: "fotos", Vídeo: "vídeos" };
const plural = (formato: string, n: number) => (n === 1 ? formato.toLowerCase() : (PLURAL[formato] ?? formato.toLowerCase()));
const COR: Record<string, string> = { Reels: "#704bfd", Carrossel: "#40095b", Foto: "#b89aff", Vídeo: "#d0aee4" };
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaSemana = (iso: string) => DIAS[new Date(new Date(iso).getTime() - 3 * 3600_000).getUTCDay()];

/**
 * Os números principais, na ordem que importa para o cliente: alcance, seguidores, leads, vendas e investimento.
 * Cada um com a leitura contra o normal dele quando dá para saber (bom, normal ou abaixo).
 */
function Numeros({ view }: { view: View }) {
  const [ref, ativo] = useReveal<HTMLDivElement>();
  const { dados, tipo, trafego, trafego_anterior: tAnt = {} } = view.semana;
  const ig = dados.instagram;
  const conta = dados.conta_ig;
  const leads = leadsDe(dados);
  const r = rotulos(tipo);
  type Card = Parameters<typeof KpiCard>[0];
  const cards: Omit<Card, "ativo" | "ordem" | "tipo">[] = [];

  // Alcance: pessoas diferentes (conta) quando vier; senão a soma do alcance dos posts.
  // A leitura (bom, normal, abaixo) compara a mesma medida com o período típico do próprio cliente.
  const tipicoTexto = (v: number) => `${tipo === "mes" ? "num mês típico" : "numa semana típica"}, você alcança ${fmtNumero(v)} pessoas`;
  if (conta) {
    const vezes = conta.atual.alcance > 0 ? conta.atual.visualizacoes / conta.atual.alcance : 0;
    const tipico = conta.tipico_alcance ?? null;
    cards.push({
      rotulo: "Pessoas alcançadas",
      k: kpiDe(conta.atual.alcance, conta.anterior?.alcance ?? null),
      destaque: true,
      leitura: leitura(conta.atual.alcance, tipico),
      detalhe: [
        `pessoas diferentes viram seu conteúdo ${r.deste}${vezes >= 1.5 ? `, cada uma cerca de ${decimal.format(Math.round(vezes * 10) / 10)} vezes` : ""}`,
        tipico ? tipicoTexto(tipico) : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  } else if (ig) {
    cards.push({
      rotulo: "Alcance",
      k: ig.alcance,
      destaque: true,
      leitura: leitura(ig.alcance.valor, ig.alcance_tipico ?? null),
      detalhe: ig.alcance_tipico
        ? `pessoas alcançadas pelos posts ${r.deste} · ${tipicoTexto(ig.alcance_tipico)}`
        : ig.historico?.mediana_alcance
          ? `pessoas alcançadas pelos posts ${r.deste} · um post seu alcança em geral ${fmtNumero(ig.historico.mediana_alcance)}`
          : `pessoas alcançadas pelos posts ${r.deste}`,
    });
  }
  // Seguidores: quem começou a seguir (e quantos deixaram), com o total.
  const seguiram = conta?.atual.seguiram ?? null;
  if (seguiram !== null) {
    cards.push({
      rotulo: "Novos seguidores",
      k: kpiDe(seguiram, conta?.anterior?.seguiram ?? null),
      sinal: true,
      detalhe: [ig?.seguidores ? `${fmtNumero(ig.seguidores)} no total` : "", conta?.atual.deixaram ? `${fmtNumero(conta.atual.deixaram)} deixaram de seguir` : ""].filter(Boolean).join(" · ") || undefined,
    });
  } else if (ig) {
    cards.push({ rotulo: "Novos seguidores", k: ig.novos_seguidores, sinal: true, detalhe: ig.seguidores ? `${fmtNumero(ig.seguidores)} no total` : undefined });
  }
  // Resultado de negócio: leads (das páginas ou dos anúncios), vendas e investimento.
  if (leads) cards.push({ rotulo: "Leads", k: leads.total, detalhe: "contatos novos que chegaram pelas páginas" });
  else if (trafego.leads) cards.push({ rotulo: "Leads", k: kpiDe(trafego.leads, tAnt.leads ?? null), detalhe: "contatos que chegaram pelos anúncios" });
  if (trafego.vendas) cards.push({ rotulo: "Vendas", k: kpiDe(trafego.vendas, tAnt.vendas ?? null), detalhe: trafego.faturamento ? `${moedaCurta(trafego.faturamento)} em vendas` : undefined });
  if (trafego.investimento) cards.push({ rotulo: "Investimento em anúncios", k: kpiDe(trafego.investimento, tAnt.investimento ?? null), neutro: true, formato: moedaCurta, detalhe: trafego.roas ? `cada R$ 1 investido voltou R$ ${decimal.format(trafego.roas)}` : undefined });
  // Engajamento: de quem viu, quantos interagiram.
  const taxa = taxaEngajamento(conta?.atual);
  if (taxa !== null) cards.push({ rotulo: "Taxa de engajamento", k: kpiDe(taxa, taxaEngajamento(conta?.anterior)), formato: (n) => `${decimal.format(Math.round(n * 10) / 10)}%`, detalhe: `${fmtNumero(conta!.atual.engajadas)} pessoas interagiram com você` });
  // Poucos números? Completa com os do Instagram.
  if (ig && cards.length < 4) cards.push({ rotulo: "Interações", k: ig.interacoes, detalhe: "curtidas, comentários, salvamentos e compartilhamentos" });
  if (ig && cards.length < 4) cards.push({ rotulo: "Salvos e compartilhados", k: ig.salvos_compart, detalhe: "o sinal de conteúdo que as pessoas querem guardar" });
  const visiveis = cards.filter((c) => c.k.valor !== null).slice(0, 6);
  if (!visiveis.length) return null;
  return (
    <div ref={ref} className={`rs-kpis rs-kpis-n${visiveis.length} ${ativo ? "is-in" : ""}`}>
      {visiveis.map((c, i) => (
        <KpiCard key={c.rotulo} {...c} ativo={ativo} ordem={i} tipo={tipo} />
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
  const fim = view.semana.semana_fim;
  const mensal = view.semana.tipo === "mes";
  // Semana: alcance por dia (segunda a domingo). Mês: por blocos de 7 dias (1–7, 8–14...). Empilhado por formato.
  const dias = useMemo(() => {
    const passo = mensal ? 7 : 1;
    const diasNoPeriodo = Math.round((Date.parse(`${fim}T12:00:00Z`) - Date.parse(`${inicio}T12:00:00Z`)) / 86_400_000) + 1;
    const qtd = mensal ? Math.ceil(diasNoPeriodo / 7) : 7;
    const base = Array.from({ length: qtd }, (_, i) => {
      const d = new Date(Date.parse(`${inicio}T12:00:00Z`) + i * passo * 86_400_000);
      const data = d.toISOString().slice(0, 10);
      const ate = new Date(d.getTime() + (passo - 1) * 86_400_000).toISOString().slice(0, 10);
      const rotulo = mensal ? `${dia(data)}–${Math.min(dia(ate), dia(fim))}` : DIAS[d.getUTCDay()];
      return { rotulo, data, ate: ate > fim ? fim : ate, total: 0, posts: 0, partes: new Map<string, number>() };
    });
    for (const p of ig?.lista ?? []) {
      if (p.alcance === null) continue;
      const local = new Date(new Date(p.publicado_em).getTime() - 3 * 3600_000).toISOString().slice(0, 10);
      const dia = base.find((d) => local >= d.data && local <= d.ate);
      if (!dia) continue;
      dia.total += p.alcance;
      dia.posts++;
      dia.partes.set(p.formato, (dia.partes.get(p.formato) ?? 0) + p.alcance);
    }
    return base;
  }, [ig, inicio, fim, mensal]);
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
          {mensal ? "Alcance por semana de publicação" : "Alcance por dia de publicação"} · melhor {mensal ? "período" : "dia"}: <strong>{melhorDia.rotulo}</strong>
        </p>
        <div className="rs-barras" role="img" aria-label="Alcance das publicações ao longo do período" style={{ gridTemplateColumns: `repeat(${dias.length}, minmax(0, 1fr))` }}>
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
  const leads = leadsDe(view.semana.dados);
  if (!leads || leads.total.valor === null) return null;
  const max = Math.max(1, ...leads.origens.map((o) => o.total));
  return (
    <div ref={ref} className={`rs-leads ${ativo ? "is-in" : ""}`}>
      <div className="rs-leads-total">
        <p className="rs-kpi-valor rs-gigante">
          <Contador valor={leads.total.valor} ativo={ativo} />
        </p>
        <p className="rs-leads-rotulo">leads {rotulos(view.semana.tipo).no}</p>
        <Variacao k={leads.total} tipo={view.semana.tipo} />
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
  const ant = view.semana.trafego_anterior ?? {};
  const itens: { campo: keyof TrafegoSemana; rotulo: string; valor: number; fmt: (n: number) => string; inverso?: boolean }[] = [];
  if (t.investimento != null) itens.push({ campo: "investimento", rotulo: "Investimento", valor: t.investimento, fmt: moedaCurta });
  if (t.leads) itens.push({ campo: "leads", rotulo: "Leads", valor: t.leads, fmt: (n) => inteiro.format(n) });
  if (t.cpl != null && t.leads !== 0) itens.push({ campo: "cpl", rotulo: "Custo por lead", valor: t.cpl, fmt: (n) => moeda.format(n), inverso: true });
  if (t.vendas) itens.push({ campo: "vendas", rotulo: "Vendas", valor: t.vendas, fmt: (n) => inteiro.format(n) });
  if (t.faturamento) itens.push({ campo: "faturamento", rotulo: "Faturamento", valor: t.faturamento, fmt: moedaCurta });
  if (t.roas) itens.push({ campo: "roas", rotulo: "Retorno (ROAS)", valor: t.roas, fmt: (n) => `${decimal.format(n)}x` });
  if (!itens.length && !t.observacao) return null;
  return (
    <div ref={ref} className={`rs-trafego ${ativo ? "is-in" : ""}`}>
      <div className={`rs-trafego-grade rs-trafego-n${itens.length} ${itens.length === 5 ? "is-cheia" : ""}`}>
        {itens.map((it, i) => {
          const anterior = ant[it.campo];
          return (
            <div key={it.rotulo} className="rs-trafego-item" style={{ "--i": i } as React.CSSProperties}>
              <p>{it.rotulo}</p>
              <strong>
                <Contador valor={it.valor} ativo={ativo} formato={it.fmt} />
              </strong>
              {anterior != null && (
                <Variacao k={{ valor: it.valor, anterior }} tipo={view.semana.tipo} inverso={it.inverso} neutro={it.campo === "investimento"} />
              )}
            </div>
          );
        })}
      </div>
      {t.observacao && <p className="rs-trafego-obs">{t.observacao}</p>}
    </div>
  );
}

function Check({ i }: { i: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ "--i": i } as React.CSSProperties}>
      <circle cx="12" cy="12" r="11" />
      <path d="M7 12.5l3.2 3.2L17 9" />
    </svg>
  );
}

/** O trabalho da Mantora: a contagem do que ficou pronto e as três colunas (feito, em andamento, o que vem por aí). */
function Trabalho({ view, comProximos }: { view: View; comProximos: boolean }) {
  const { dados, textos, entregas, tipo } = view.semana;
  const producao = dados.trabalho?.producao ?? [];
  const totalProduzido = producao.reduce((t, p) => t + p.total, 0);
  const feito = [...(textos.feito ?? []), ...dados.aprovadas.map((a) => `${a.titulo} (aprovado por você)`), ...(entregas ?? [])].filter(Boolean);
  const andamento = (textos.andamento ?? []).filter(Boolean);
  const proximos = comProximos ? (textos.proximos ?? []).filter(Boolean) : [];
  const colunas = [
    { chave: "feito", titulo: tipo === "mes" ? "Feito no mês" : "Feito na semana", itens: feito },
    { chave: "andamento", titulo: "Em andamento", itens: andamento },
    { chave: "proximo", titulo: tipo === "mes" ? "O que vem no próximo mês" : "O que vem na próxima semana", itens: proximos },
  ].filter((c) => c.itens.length > 0);
  const [ref, ativo] = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`rs-trabalho ${ativo ? "is-in" : ""}`}>
      {totalProduzido >= 2 && (
        <div className="rs-producao">
          <div className="rs-producao-item rs-producao-total" style={{ "--i": 0 } as React.CSSProperties}>
            <strong>
              <Contador valor={totalProduzido} ativo={ativo} />
            </strong>
            <p className="rs-producao-rotulo">{tipo === "mes" ? "entregas prontas no mês" : "entregas prontas na semana"}</p>
          </div>
          {producao.length > 1 &&
            producao.slice(0, 5).map((p, i) => (
              <div key={p.rotulo} className="rs-producao-item" style={{ "--i": i + 1 } as React.CSSProperties}>
                <strong>
                  <Contador valor={p.total} ativo={ativo} />
                </strong>
                <p className="rs-producao-rotulo">{p.rotulo}</p>
              </div>
            ))}
        </div>
      )}
      <div className={`rs-trabalho-cols rs-trabalho-cols-${colunas.length}`}>
        {colunas.map((c, ci) => (
          <section key={c.chave} className={`rs-trabalho-col rs-trabalho-${c.chave}`} style={{ "--i": ci } as React.CSSProperties}>
            <h3>
              <span className="rs-trabalho-ponto" aria-hidden="true" />
              {c.titulo}
            </h3>
            <ul>
              {c.itens.map((e, i) => (
                <li key={`${e}-${i}`} style={{ "--i": i } as React.CSSProperties}>
                  {c.chave === "feito" ? <Check i={i} /> : <span className={`rs-trabalho-marca rs-trabalho-marca-${c.chave}`} aria-hidden="true" />}
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

const GRADIENTES = ["var(--rs-g1)", "var(--rs-g2)", "var(--rs-g3)", "var(--rs-g4)"];

/** Momentos do período, no espírito de uma retrospectiva: o número grande com o contexto do próprio perfil. */
function Momentos({ view }: { view: View }) {
  const marcos = view.semana.dados.marcos ?? [];
  const ig = view.semana.dados.instagram;
  if (!marcos.length) return null;
  const capa = (m: Marco) => {
    const post = m.media_id ? ig?.lista.find((p) => p.media_id === m.media_id) : undefined;
    return post?.capa ? view.capas[post.capa] : undefined;
  };
  return (
    <div className={`rs-momentos rs-momentos-${Math.min(marcos.length, 4)}`}>
      {marcos.map((m, i) => {
        const img = capa(m);
        return (
          <article key={i} className="rs-momento" style={{ "--i": i, background: GRADIENTES[i % GRADIENTES.length] } as React.CSSProperties}>
            {img && <img src={img} alt="" className="rs-momento-capa" />}
            <div className="rs-momento-brilho" />
            <p className="rs-momento-titulo">{m.titulo}</p>
            <p className="rs-momento-valor">
              <ComUnidade texto={m.valor} />
            </p>
            <p className="rs-momento-texto">{m.texto}</p>
          </article>
        );
      })}
    </div>
  );
}

function MiniPost({ post, view, sinal }: { post: PostSemana; view: View; sinal: "acima" | "abaixo" }) {
  const mediana = view.semana.dados.instagram?.historico?.mediana_alcance;
  const x = mediana && post.alcance !== null ? post.alcance / mediana : null;
  const conteudo = (
    <>
      <div className="rs-mini-capa">
        <CapaPost post={post} capas={view.capas} />
      </div>
      <div className="rs-mini-corpo">
        <p className="rs-mini-legenda">{post.legenda || post.formato}</p>
        <p className="rs-mini-num">
          {post.alcance !== null ? `${fmtNumero(post.alcance)} de alcance` : "sem métrica"}
          {x !== null && <b className={sinal === "acima" ? "rs-mini-sobe" : "rs-mini-desce"}>{`${decimal.format(Math.round(x * 10) / 10)}x o normal`}</b>}
        </p>
      </div>
    </>
  );
  return post.permalink ? (
    <a className="rs-mini" href={post.permalink} target="_blank" rel="noreferrer">
      {conteudo}
    </a>
  ) : (
    <div className="rs-mini">{conteudo}</div>
  );
}

function Funcionou({ view }: { view: View }) {
  const ig = view.semana.dados.instagram;
  const textos = view.semana.textos;
  const acima = (ig?.acima ?? []).slice(0, 3).map((id) => ig?.lista.find((p) => p.media_id === id)).filter((p): p is PostSemana => Boolean(p));
  const abaixo = (ig?.abaixo ?? []).slice(0, 3).map((id) => ig?.lista.find((p) => p.media_id === id)).filter((p): p is PostSemana => Boolean(p));
  const funcionou = textos.funcionou?.filter(Boolean) ?? [];
  const ajustar = textos.ajustar?.filter(Boolean) ?? [];
  if (!funcionou.length && !ajustar.length && !acima.length && !abaixo.length) return null;
  return (
    <div className="rs-fa">
      <div className="rs-fa-col rs-fa-ok" style={{ "--i": 0 } as React.CSSProperties}>
        <p className="rs-fa-rotulo">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5l4.2 4.2L19 7" />
          </svg>
          O que funcionou
        </p>
        <ul>
          {funcionou.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
        {acima.length > 0 && (
          <div className="rs-minis">
            {acima.map((p) => (
              <MiniPost key={p.media_id} post={p} view={view} sinal="acima" />
            ))}
          </div>
        )}
      </div>
      {(ajustar.length > 0 || abaixo.length > 0) && (
        <div className="rs-fa-col rs-fa-ajuste" style={{ "--i": 1 } as React.CSSProperties}>
          <p className="rs-fa-rotulo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12a8 8 0 0 1 13.7-5.6M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6M4 20v-5h5" />
            </svg>
            O que vamos ajustar
          </p>
          <ul>
            {ajustar.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          {abaixo.length > 0 && (
            <div className="rs-minis">
              {abaixo.map((p) => (
                <MiniPost key={p.media_id} post={p} view={view} sinal="abaixo" />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Todos os números, para quem quer aprofundar: fechado por padrão (abre sozinho na impressão). */
function TodosNumeros({ view }: { view: View }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const abrir = () => ref.current?.setAttribute("open", "");
    window.addEventListener("beforeprint", abrir);
    return () => window.removeEventListener("beforeprint", abrir);
  }, []);
  const ig = view.semana.dados.instagram;
  const t = view.semana.trafego;
  const mediana = ig?.historico?.mediana_alcance ?? null;
  const trafego: [string, string][] = [];
  const add = (rotulo: string, v: number | null | undefined, f: (n: number) => string) => {
    if (v !== null && v !== undefined) trafego.push([rotulo, f(v)]);
  };
  add("Investimento", t.investimento, (n) => moeda.format(n));
  add("Impressões", t.impressoes, (n) => inteiro.format(n));
  add("Cliques", t.cliques, (n) => inteiro.format(n));
  add("CTR", t.ctr, (n) => `${decimal.format(n)}%`);
  add("CPC", t.cpc, (n) => moeda.format(n));
  add("CPM", t.cpm, (n) => moeda.format(n));
  add("Custo por visualização", t.cpv, (n) => moeda.format(n));
  add("Conversas iniciadas", t.conversas || null, (n) => inteiro.format(n));
  add("Leads", t.leads || null, (n) => inteiro.format(n));
  add("Custo por lead", t.leads === 0 ? null : t.cpl, (n) => moeda.format(n));
  add("Vendas", t.vendas, (n) => inteiro.format(n));
  add("Faturamento", t.faturamento, (n) => moeda.format(n));
  add("ROAS", t.roas, (n) => `${decimal.format(n)}x`);
  const lista = ig?.lista ?? [];
  if (!lista.length && !trafego.length) return null;
  const eng = (p: PostSemana) => (p.alcance && p.interacoes !== null ? `${decimal.format(Math.round((p.interacoes / p.alcance) * 1000) / 10)}%` : "–");
  const n = (v: number | null) => (v === null ? "–" : inteiro.format(v));
  return (
    <details ref={ref} className="rs-detalhes">
      <summary>
        <span>Ver todos os números {rotulos(view.semana.tipo).deste}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div className="rs-detalhes-corpo">
        {trafego.length > 0 && (
          <div className="rs-tabela-bloco">
            <h3>Tráfego pago</h3>
            <dl className="rs-dl">
              {trafego.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {ig && (
          <div className="rs-tabela-bloco">
            <h3>Instagram</h3>
            <dl className="rs-dl">
              {[
                ["Seguidores", ig.seguidores],
                ["Novos seguidores", ig.novos_seguidores.valor],
                ["Publicações", ig.posts.valor],
                ["Alcance (soma dos posts)", ig.alcance.valor],
                ["Visualizações", ig.visualizacoes.valor],
                ["Interações", ig.interacoes.valor],
                ["Salvos e compartilhados", ig.salvos_compart.valor],
                ["Alcance normal de um post", mediana === null ? null : Math.round(mediana)],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt>{k}</dt>
                  <dd>{n(v as number | null)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        {lista.length > 0 && (
          <div className="rs-tabela-bloco">
            <h3>Cada publicação</h3>
            <div className="rs-tabela-rolagem">
              <table className="rs-tabela">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Formato</th>
                    <th className="rs-col-legenda">Publicação</th>
                    <th>Alcance</th>
                    {mediana !== null && <th>vs. normal</th>}
                    <th>Visualiz.</th>
                    <th>Interações</th>
                    <th>Salvos</th>
                    <th>Compart.</th>
                    <th>Engaj.</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => (
                    <tr key={p.media_id}>
                      <td>{curtoData(new Date(new Date(p.publicado_em).getTime() - 3 * 3600_000).toISOString().slice(0, 10))}</td>
                      <td>{p.formato}</td>
                      <td className="rs-col-legenda">
                        {p.permalink ? (
                          <a href={p.permalink} target="_blank" rel="noreferrer">
                            {p.legenda || "abrir"}
                          </a>
                        ) : (
                          p.legenda
                        )}
                      </td>
                      <td>{n(p.alcance)}</td>
                      {mediana !== null && <td>{p.alcance === null ? "–" : `${decimal.format(Math.round((p.alcance / mediana) * 10) / 10)}x`}</td>}
                      <td>{n(p.visualizacoes)}</td>
                      <td>{n(p.interacoes)}</td>
                      <td>{n(p.salvamentos)}</td>
                      <td>{n(p.compartilhamentos)}</td>
                      <td>{eng(p)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {ig?.medido_em && (
              <p className="rs-nota">
                Métricas do Instagram coletadas em {curtoData(ig.medido_em)}.
                {ig.historico ? ` "Normal" = mediana de ${ig.historico.posts} posts publicados desde ${curtoData(ig.historico.desde)}.` : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

// ---------- Seções novas: público, o que depende do cliente, palavras, nicho, antes e depois ----------

/** URL da capa de um post (do período ou do "antes e depois"). */
function capaDe(view: View, mediaId: string): string | undefined {
  const post = view.semana.dados.instagram?.lista.find((p) => p.media_id === mediaId);
  const caminho = post?.capa ?? view.semana.dados.antes_depois?.capas?.[mediaId];
  return caminho ? view.capas[caminho] : undefined;
}

function primeiroNome(nome: string): string {
  return nome.split(/\s+/).find((p) => p.length > 2 && !/^(dra?|sr|sra)\.?$/i.test(p)) ?? nome;
}

function Publico({ view }: { view: View }) {
  const [ref, ativo] = useReveal<HTMLDivElement>();
  const p = view.semana.dados.publico;
  if (!p) return null;
  const max = Math.max(1, ...p.idade.map((x) => x.pct));
  const maior = [...p.idade].sort((a, b) => b.pct - a.pct)[0];
  return (
    <div ref={ref} className={`rs-publico ${ativo ? "is-in" : ""}`}>
      <div className="rs-publico-barras">
        {p.idade.map((x, i) => (
          <div key={x.faixa} className={`rs-publico-linha ${x === maior ? "is-maior" : ""}`} style={{ "--i": i } as React.CSSProperties}>
            <span>{x.faixa}</span>
            <div className="rs-publico-trilho">
              <div className="rs-publico-barra" style={{ "--w": `${(x.pct / max) * 100}%` } as React.CSSProperties} />
            </div>
            <b>{decimal.format(x.pct)}%</b>
          </div>
        ))}
      </div>
      <div className="rs-publico-lado">
        {maior && (
          <p className="rs-publico-frase">
            Quem mais acompanha você tem <b>{maior.faixa.replace("-", " a ")} anos</b>.
          </p>
        )}
        {p.mulheres !== null && p.homens !== null && (
          <div className="rs-publico-genero">
            <div style={{ "--w": `${p.mulheres}%` } as React.CSSProperties} />
            <p>
              <span>{decimal.format(p.mulheres)}% mulheres</span>
              <span>{decimal.format(p.homens)}% homens</span>
            </p>
          </div>
        )}
        {p.cidades.length > 0 && (
          <ul className="rs-publico-cidades">
            {p.cidades.map((c) => (
              <li key={c.cidade}>
                <span>{c.cidade}</span>
                <b>{decimal.format(c.pct)}%</b>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Pendencias({ view }: { view: View }) {
  const lista = view.semana.dados.pendencias ?? [];
  const [aberto, setAberto] = useState(true);
  if (!lista.length) return null;
  const dataCurta = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");
  return (
    <div className="rs-pend">
      <button type="button" className="rs-pend-topo" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
        <span className="rs-pend-n">{lista.length}</span>
        <span className="rs-pend-texto">
          <b>{lista.length === 1 ? "item precisa de você" : "itens precisam de você"}</b>
          <small>Para a gente concluir, precisamos do seu retorno nestes pontos.</small>
        </span>
        <span className={`rs-pend-seta ${aberto ? "is-aberto" : ""}`} aria-hidden="true" />
      </button>
      {aberto && (
        <ul className="rs-pend-lista">
          {lista.map((p, i) => (
            <li key={i}>
              <span className="rs-pend-tipo">{p.tipo}</span>
              <span className="rs-pend-titulo">{p.titulo}</span>
              {p.link ? (
                <a className="rs-pend-acao" href={p.link} target="_blank" rel="noreferrer">
                  Aprovar
                </a>
              ) : (
                <span className="rs-pend-desde">{p.desde ? `desde ${dataCurta(p.desde)}` : ""}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Palavras({ view }: { view: View }) {
  const lista = (view.semana.textos.palavras ?? []).filter(Boolean);
  if (!lista.length) return null;
  return (
    <div className={`rs-palavras rs-palavras-${Math.min(lista.length, 3)}`}>
      {lista.map((t, i) => (
        <figure key={i} className="rs-palavra-card" style={{ "--i": i } as React.CSSProperties}>
          <span className="rs-aspas" aria-hidden="true">
            “
          </span>
          <blockquote>{t}</blockquote>
          <figcaption>comentário no seu perfil</figcaption>
        </figure>
      ))}
    </div>
  );
}

function NichoCard({ view }: { view: View }) {
  const [ref, ativo] = useReveal<HTMLDivElement>();
  const n = view.semana.dados.nicho;
  if (!n || n.cliente === null || n.media === null) return null;
  const max = Math.max(n.cliente, n.media);
  const acima = (n.vezes ?? 0) >= 1.1;
  return (
    <div ref={ref} className={`rs-nicho ${ativo ? "is-in" : ""}`}>
      <div>
        <p className="rs-nicho-grande">{acima ? `${decimal.format(n.vezes!)}x` : `${decimal.format(n.cliente)}%`}</p>
        <p className="rs-nicho-frase">
          {acima
            ? "o engajamento médio dos perfis parecidos com o seu"
            : `de engajamento por post, contra ${decimal.format(n.media)}% da média dos perfis parecidos com o seu`}
        </p>
      </div>
      <div className="rs-nicho-barras">
        {[
          ["Você", n.cliente, true],
          ["Média do nicho", n.media, false],
        ].map(([rotulo, v, voce]) => (
          <div key={rotulo as string} className={`rs-nicho-linha ${voce ? "is-voce" : ""}`}>
            <span>{rotulo as string}</span>
            <div className="rs-nicho-trilho">
              <div style={{ "--w": `${((v as number) / max) * 100}%` } as React.CSSProperties} />
            </div>
            <b>{decimal.format(v as number)}%</b>
          </div>
        ))}
        {n.topo_pct !== null && n.topo_pct <= 50 && (
          <p className="rs-nicho-nota">
            Você ficou entre os <b>{n.topo_pct}%</b> perfis com mais engajamento entre os {n.total} que acompanhamos.
          </p>
        )}
      </div>
    </div>
  );
}

function AntesDepoisSec({ view }: { view: View }) {
  const ad = view.semana.dados.antes_depois;
  if (!ad) return null;
  const lado = (titulo: string, d: typeof ad.antes, capas: string[], depois: boolean) => (
    <div className={`rs-ad-lado ${depois ? "is-depois" : ""}`}>
      <p className="rs-ad-rotulo">{titulo}</p>
      <p className="rs-ad-mes">{d.rotulo}</p>
      <div className="rs-ad-capas">
        {capas.map((id) => {
          const url = capaDe(view, id);
          return <div key={id} className="rs-ad-capa">{url ? <img src={url} alt="" loading="lazy" /> : null}</div>;
        })}
      </div>
      {d.mediana_alcance !== null && (
        <p className="rs-ad-num">
          <b>{fmtNumero(d.mediana_alcance)}</b> pessoas alcançadas por post, em média
        </p>
      )}
      {d.mediana_salvos_compart !== null && (
        <p className="rs-ad-num">
          <b>{fmtNumero(d.mediana_salvos_compart)}</b> salvamentos e compartilhamentos por post
        </p>
      )}
    </div>
  );
  return (
    <div className="rs-ad">
      {lado("Quando começamos a acompanhar", ad.antes, ad.capas_antes, false)}
      <span className="rs-ad-seta" aria-hidden="true" />
      {lado("Agora", ad.depois, ad.capas_depois, true)}
    </div>
  );
}

/** Todos os relatórios publicados do cliente, em cards (o aberto agora fica marcado). */
function CardsRelatorios({ view, onSemana }: { view: View; onSemana?: (periodo: string) => void }) {
  const lista = view.semanas ?? [];
  if (lista.length < 2 || !onSemana) return null;
  const atual = `${view.semana.tipo ?? "semana"}:${view.semana.semana_inicio}`;
  const fmtN = (v: number, f?: string) => (f === "moeda" ? moedaCurta(v) : f === "pct" ? `${decimal.format(v)}%` : fmtNumero(v));
  return (
    <div className="rs-cards">
      {lista.slice(0, 9).map((c, i) => {
        const chave = `${c.tipo}:${c.inicio}`;
        const tag = c.tipo === "mes" ? "Retrospectiva" : c.visto ? "Lido" : "Novo";
        return (
          <button
            key={chave}
            type="button"
            className={`rs-card ${chave === atual ? "is-atual" : ""}`}
            style={{ "--i": i } as React.CSSProperties}
            onClick={() => {
              onSemana(chave);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <span className="rs-card-topo">
              <span className={`rs-card-tag rs-card-tag-${tag.toLowerCase()}`}>{chave === atual ? "Aberto agora" : tag}</span>
              <span className="rs-card-tipo">{c.tipo === "mes" ? "Mensal" : "Semanal"}</span>
            </span>
            <span className="rs-card-periodo">{c.tipo === "mes" ? `${mes(c.inicio).replace(/^./, (x) => x.toUpperCase())} de ${c.inicio.slice(0, 4)}` : `${curtoData(c.inicio)} a ${curtoData(c.fim)}`}</span>
            {c.titulo && <span className="rs-card-frase">{c.titulo}</span>}
            {c.numeros && c.numeros.length > 0 && (
              <span className="rs-card-nums">
                {c.numeros.map((n) => (
                  <span key={n.rotulo}>
                    <b>{fmtN(n.valor, n.formato)}</b>
                    <small>{n.rotulo}</small>
                  </span>
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Retrospectiva (mês), no estilo das retrospectivas de fim de ano ----------

interface Tela {
  id: string;
  eyebrow: string;
  conteudo: React.ReactNode;
}

function telasDaRetrospectiva(view: View): Tela[] {
  const { cliente, semana } = view;
  const { dados, textos, trafego } = semana;
  const ig = dados.instagram;
  const nomeMes = mes(semana.semana_inicio);
  const Mes = nomeMes.replace(/^./, (x) => x.toUpperCase());
  const proxMes = MESES[(Number(semana.semana_inicio.slice(5, 7)) % 12)];
  const telas: Tela[] = [];
  telas.push({
    id: "abertura",
    eyebrow: "Retrospectiva",
    conteudo: (
      <>
        <h2 className="rs-st-titulo">
          {Mes} foi o seu mês, {primeiroNome(cliente.nome)}.
        </h2>
        <p className="rs-st-texto">Separamos o que mais marcou o seu perfil em {nomeMes}. Toque para continuar.</p>
      </>
    ),
  });
  const alcance = dados.conta_ig?.atual.alcance ?? ig?.alcance.valor ?? null;
  if (alcance) {
    const recorde = dados.marcos?.find((m) => /maior alcance/i.test(m.titulo));
    const anterior = dados.conta_ig?.anterior?.alcance ?? ig?.alcance.anterior ?? null;
    const v = anterior ? variacao({ valor: alcance, anterior }) : null;
    telas.push({
      id: "alcance",
      eyebrow: "Alcance do mês",
      conteudo: (
        <>
          <p className="rs-st-numero">{fmtNumero(alcance)}</p>
          <p className="rs-st-unidade">pessoas viram o seu conteúdo</p>
          <p className="rs-st-texto">
            {recorde ? `${recorde.titulo}.` : v !== null && v > 0 ? `${decimal.format(v)}% a mais que no mês anterior.` : textos.resumo.split(/(?<=\.)\s/)[0]}
          </p>
        </>
      ),
    });
  }
  const n = dados.nicho;
  if (n && n.cliente !== null && n.media !== null) {
    const acima = (n.vezes ?? 0) >= 1.1;
    const max = Math.max(n.cliente, n.media);
    telas.push({
      id: "nicho",
      eyebrow: "Comparado ao seu nicho",
      conteudo: (
        <>
          <h2 className="rs-st-titulo rs-st-titulo-m">
            {acima ? `Seu engajamento foi ${decimal.format(n.vezes!)}x a média dos perfis parecidos com o seu.` : `Seu engajamento foi de ${decimal.format(n.cliente)}% por post.`}
          </h2>
          <div className="rs-st-barras">
            {[
              ["Você", n.cliente],
              ["Média do nicho", n.media],
            ].map(([r, v]) => (
              <div key={r as string}>
                <span>{r as string}</span>
                <i style={{ "--w": `${((v as number) / max) * 100}%` } as React.CSSProperties} />
                <b>{decimal.format(v as number)}%</b>
              </div>
            ))}
          </div>
          {n.topo_pct !== null && n.topo_pct <= 50 && (
            <p className="rs-st-texto">
              Você ficou entre os {n.topo_pct}% perfis com mais engajamento entre os {n.total} que acompanhamos.
            </p>
          )}
        </>
      ),
    });
  }
  const melhor = ig?.melhores[0] ? ig.lista.find((p) => p.media_id === ig.melhores[0]) : undefined;
  if (melhor && melhor.alcance !== null) {
    const capa = capaDe(view, melhor.media_id);
    const vezes = ig?.historico?.mediana_alcance ? melhor.alcance / ig.historico.mediana_alcance : null;
    telas.push({
      id: "conteudo",
      eyebrow: "O conteúdo do mês",
      conteudo: (
        <>
          <div className="rs-st-post">{capa ? <img src={capa} alt="" /> : <span>{melhor.formato}</span>}</div>
          <p className="rs-st-numero rs-st-numero-m">{fmtNumero(melhor.alcance)}</p>
          <p className="rs-st-unidade">pessoas alcançadas{vezes && vezes >= 1.5 ? `, ${decimal.format(Math.round(vezes * 10) / 10)}x o seu normal` : ""}</p>
          <p className="rs-st-legenda">{melhor.legenda}</p>
        </>
      ),
    });
  }
  const palavras = (textos.palavras ?? []).filter(Boolean).slice(0, 3);
  if (palavras.length) {
    telas.push({
      id: "palavras",
      eyebrow: "Palavras que aqueceram",
      conteudo: (
        <div className="rs-st-falas">
          {palavras.map((t, i) => (
            <blockquote key={i} style={{ "--i": i } as React.CSSProperties}>
              “{t}”
            </blockquote>
          ))}
        </div>
      ),
    });
  }
  const producao = dados.trabalho?.producao ?? [];
  const total = producao.reduce((t, p) => t + p.total, 0);
  if (total >= 2 || (textos.feito ?? []).length) {
    telas.push({
      id: "juntos",
      eyebrow: "O que fizemos juntos",
      conteudo: (
        <>
          {total >= 2 && (
            <>
              <p className="rs-st-numero">{total}</p>
              <p className="rs-st-unidade">entregas prontas em {nomeMes}</p>
            </>
          )}
          <ul className="rs-st-lista">
            {(producao.length > 1 ? producao.slice(0, 4).map((p) => `${p.total} ${p.rotulo}`) : (textos.feito ?? []).slice(0, 3)).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {trafego.investimento ? <p className="rs-st-texto">E {moedaCurta(trafego.investimento)} em anúncios trabalhando por você.</p> : null}
        </>
      ),
    });
  }
  const ad = dados.antes_depois;
  if (ad && antesDepoisMelhorou(ad)) {
    const porAlcance = (ad.depois.mediana_alcance ?? 0) >= (ad.antes.mediana_alcance ?? 0) * 1.1;
    telas.push({
      id: "antes-depois",
      eyebrow: "Antes e depois",
      conteudo: (
        <>
          <h2 className="rs-st-titulo rs-st-titulo-m">
            {porAlcance
              ? `Em ${ad.antes.rotulo}, um post seu alcançava ${fmtNumero(ad.antes.mediana_alcance ?? 0)} pessoas. Em ${nomeMes}, ${fmtNumero(ad.depois.mediana_alcance ?? 0)}.`
              : `Em ${ad.antes.rotulo}, um post seu era salvo ou compartilhado ${fmtNumero(ad.antes.mediana_salvos_compart ?? 0)} vezes. Em ${nomeMes}, ${fmtNumero(ad.depois.mediana_salvos_compart ?? 0)}.`}
          </h2>
          <div className="rs-st-ad">
            {[ad.capas_antes, ad.capas_depois].map((ids, i) => (
              <div key={i}>
                <small>{i ? "agora" : "antes"}</small>
                <span>
                  {ids.slice(0, 3).map((id) => {
                    const u = capaDe(view, id);
                    return <i key={id}>{u ? <img src={u} alt="" /> : null}</i>;
                  })}
                </span>
              </div>
            ))}
          </div>
        </>
      ),
    });
  }
  const proximos = (textos.proximos ?? []).filter(Boolean).slice(0, 3);
  if (proximos.length) {
    telas.push({
      id: "proximo",
      eyebrow: `${proxMes.replace(/^./, (x) => x.toUpperCase())} vem aí`,
      conteudo: (
        <>
          <h2 className="rs-st-titulo rs-st-titulo-m">O que vem a seguir</h2>
          <ol className="rs-st-lista rs-st-lista-n">
            {proximos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <p className="rs-st-assinatura">
            mantora<sup>®</sup>
          </p>
        </>
      ),
    });
  }
  return telas;
}

const DURACAO_TELA = 6500;

function Retrospectiva({ view, onFechar }: { view: View; onFechar: () => void }) {
  const telas = useMemo(() => telasDaRetrospectiva(view), [view]);
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;
  const ir = (n: number) => {
    if (n < 0) return setI(0);
    if (n >= telas.length) return fechar.current?.();
    setI(n);
  };
  useEffect(() => {
    if (pausado) return;
    const t = window.setTimeout(() => ir(i + 1), DURACAO_TELA);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, pausado, telas.length]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar.current?.();
      if (e.key === "ArrowRight") ir(i + 1);
      if (e.key === "ArrowLeft") ir(i - 1);
    };
    window.addEventListener("keydown", tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla);
      document.body.style.overflow = antes;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  const tela = telas[i];
  if (!tela) return null;
  return (
    <div className="rs-story" role="dialog" aria-modal="true" aria-label="Retrospectiva do mês" style={variaveisDoTema(view.cliente.tema) as React.CSSProperties}>
      <div className={`rs-story-tela rs-story-${tela.id}`} style={{ "--g": `var(--rs-g${(i % 4) + 1})` } as React.CSSProperties}>
        <div className="rs-story-barras">
          {telas.map((t, n) => (
            <span key={t.id} className={n < i ? "is-feita" : n === i ? (pausado ? "is-pausada" : "is-agora") : ""} style={{ "--d": `${DURACAO_TELA}ms` } as React.CSSProperties}>
              <i />
            </span>
          ))}
        </div>
        <div className="rs-story-cab">
          <span className="rs-story-avatar">{view.cliente.foto ? <img src={view.cliente.foto} alt="" /> : primeiroNome(view.cliente.nome)[0]}</span>
          <span>
            Seu {mes(view.semana.semana_inicio)} · Mantora Lab
          </span>
          <button type="button" className="rs-story-fechar" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>
        <button type="button" className="rs-story-voltar" aria-label="Tela anterior" onClick={() => ir(i - 1)} />
        <button
          type="button"
          className="rs-story-avancar"
          aria-label="Próxima tela"
          onClick={() => ir(i + 1)}
          onPointerDown={() => setPausado(true)}
          onPointerUp={() => setPausado(false)}
          onPointerLeave={() => setPausado(false)}
        />
        <div key={tela.id} className="rs-story-corpo">
          <p className="rs-st-eyebrow">{tela.eyebrow}</p>
          {tela.conteudo}
        </div>
      </div>
    </div>
  );
}

function Hero({ view, onSemana, onRetrospectiva }: { view: View; onSemana?: (inicio: string) => void; onRetrospectiva?: () => void }) {
  const { cliente, semana } = view;
  const conta = semana.dados.conta_ig?.atual;
  const taxa = taxaEngajamento(conta);
  const pendencias = semana.dados.pendencias?.length ?? 0;
  const r = rotulos(semana.tipo);
  const palavras = (semana.textos.titulo || `Relatório ${r.deste}`).split(/\s+/);
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
          <small>{r.titulo}</small>
        </span>
        <div className="rs-acoes">
          {view.semanas && view.semanas.length > 1 && onSemana && (
            <label className="rs-seletor">
              <span className="sr-only">Escolher período</span>
              <select value={`${semana.tipo ?? "semana"}:${semana.semana_inicio}`} onChange={(e) => onSemana(e.target.value)}>
                {view.semanas.map((s) => (
                  <option key={`${s.tipo}:${s.inicio}`} value={`${s.tipo}:${s.inicio}`}>
                    {s.tipo === "mes" ? `Mês: ${mes(s.inicio)} de ${s.inicio.slice(0, 4)}` : `Semana: ${curtoData(s.inicio)} a ${curtoData(s.fim)}`}
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
            <p className="rs-periodo">{nomePeriodo(semana.tipo, semana.semana_inicio, semana.semana_fim)}</p>
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
        {conta && conta.visualizacoes > 0 && (
          <p className="rs-hero-dados">
            Seu conteúdo foi visto <b>{fmtNumero(conta.visualizacoes)} vezes</b> por <b>{fmtNumero(conta.alcance)} pessoas</b>
            {taxa !== null ? (
              <>
                , e <b>{decimal.format(taxa)}%</b> delas interagiram.
              </>
            ) : (
              "."
            )}
          </p>
        )}
        {semana.textos.resumo && <p className="rs-resumo">{semana.textos.resumo}</p>}
        {(onRetrospectiva || pendencias > 0) && (
          <div className="rs-hero-botoes">
            {onRetrospectiva && (
              <button type="button" className="rs-botao-retro" onClick={onRetrospectiva}>
                <span aria-hidden="true">▶</span> Ver a retrospectiva de {mes(semana.semana_inicio)}
              </button>
            )}
            {pendencias > 0 && (
              <a className="rs-botao-pend" href="#pendencias">
                <b>{pendencias}</b> {pendencias === 1 ? "item precisa de você" : "itens precisam de você"}
              </a>
            )}
          </div>
        )}
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
  const temFeito = (semana.textos.feito?.length ?? 0) + (semana.textos.andamento?.length ?? 0) + (semana.dados.trabalho?.producao.length ?? 0) + semana.dados.aprovadas.length + (semana.entregas?.length ?? 0) > 0;
  const temTrabalho = (mostra("entregas") && temFeito) || (mostra("proximos") && proximos.length > 0);
  const temGrafico = (ig?.lista.filter((p) => p.alcance !== null).length ?? 0) >= 2;
  const r = rotulos(semana.tipo);
  const temFuncionou = (semana.textos.funcionou?.length ?? 0) + (semana.textos.ajustar?.length ?? 0) + (ig?.acima?.length ?? 0) + (ig?.abaixo?.length ?? 0) > 0;
  const [retro, setRetro] = useState(false);
  const temRetro = semana.tipo === "mes" && mostra("momentos");
  const tema = useMemo(() => variaveisDoTema(view.cliente.tema), [view.cliente.tema]);
  return (
    <div className="rs" style={tema as React.CSSProperties}>
      <Hero view={view} onSemana={onSemana} onRetrospectiva={temRetro ? () => setRetro(true) : undefined} />
      {retro && <Retrospectiva view={view} onFechar={() => setRetro(false)} />}

      {mostra("momentos") && (semana.dados.marcos?.length ?? 0) > 0 && (
        <Secao id="momentos" eyebrow={`Momentos ${r.deste}`} titulo={semana.tipo === "mes" ? "O mês em destaque" : "A semana em destaque"}>
          <Momentos view={view} />
        </Secao>
      )}

      {mostra("numeros") && (ig || leadsDe(semana.dados)) && (
        <Secao id="numeros" eyebrow="Os números" titulo={semana.tipo === "mes" ? "Como o mês performou" : "Como a semana performou"}>
          <Numeros view={view} />
          {ig?.parcial && <p className="rs-nota">Números do Instagram parciais: a coleta {r.deste} ainda não foi feita.</p>}
        </Secao>
      )}

      {mostra("nicho") && semana.dados.nicho?.cliente != null && (
        <Secao id="nicho" eyebrow="Comparado ao seu nicho" titulo="Como você se sai entre perfis parecidos">
          <NichoCard view={view} />
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
        <Secao id="conteudos" eyebrow="Conteúdos" titulo={semana.tipo === "mes" ? "Os melhores do mês" : "Os melhores da semana"}>
          <Melhores view={view} />
        </Secao>
      )}

      {mostra("funcionou") && temFuncionou && (
        <Secao id="funcionou" eyebrow="Leitura" titulo="O que funcionou e o que vamos ajustar">
          <Funcionou view={view} />
        </Secao>
      )}

      {mostra("palavras") && (semana.textos.palavras?.length ?? 0) > 0 && (
        <Secao id="palavras" eyebrow="Palavras que aqueceram" titulo="O que disseram sobre você">
          <Palavras view={view} />
        </Secao>
      )}

      {mostra("grafico") && temGrafico && (
        <Secao id="grafico" eyebrow="Alcance" titulo={semana.tipo === "mes" ? "Onde o mês rendeu mais" : "Onde a semana rendeu mais"}>
          <Grafico view={view} />
        </Secao>
      )}

      {mostra("publico") && semana.dados.publico && (
        <Secao id="publico" eyebrow="Seu público" titulo="Quem está vendo você">
          <Publico view={view} />
        </Secao>
      )}

      {mostra("leads") && leadsDe(semana.dados) && (
        <Secao id="leads" eyebrow="Captação" titulo="Leads que chegaram">
          <Leads view={view} />
        </Secao>
      )}

      {mostra("trafego") && temTrafego && (
        <Secao id="trafego" eyebrow="Tráfego pago" titulo="Investimento e retorno" escura>
          <Trafego view={view} />
        </Secao>
      )}

      {temTrabalho && (
        <Secao id="entregas" eyebrow="O trabalho da Mantora" titulo="O que fizemos, o que está andando e o que vem aí">
          <Trabalho view={view} comProximos={mostra("proximos")} />
        </Secao>
      )}

      {mostra("pendencias") && (semana.dados.pendencias?.length ?? 0) > 0 && (
        <Secao id="pendencias" eyebrow="Com você" titulo="O que depende de você">
          <Pendencias view={view} />
        </Secao>
      )}

      {semana.tipo === "mes" && mostra("momentos") && antesDepoisMelhorou(semana.dados.antes_depois) && (
        <Secao id="antes-depois" eyebrow="Antes e depois" titulo="Como o seu perfil mudou">
          <AntesDepoisSec view={view} />
        </Secao>
      )}

      {(view.semanas?.length ?? 0) > 1 && onSemana && (
        <Secao id="relatorios" eyebrow="Seus relatórios" titulo="Semanais toda segunda, retrospectiva todo mês">
          <CardsRelatorios view={view} onSemana={onSemana} />
        </Secao>
      )}

      {mostra("detalhes") && (
        <section className="rs-secao rs-secao-detalhes">
          <div className="rs-container">
            <TodosNumeros view={view} />
          </div>
        </section>
      )}

      <footer className="rs-rodape">
        <div className="rs-container">
          <span className="rs-marca rs-marca-rodape">
            mantora<sup>®</sup>
          </span>
          <p>
            Relatório preparado pela equipe Mantora Lab · {nomePeriodo(semana.tipo, semana.semana_inicio, semana.semana_fim)}
            {ig?.medido_em ? ` · Instagram medido em ${curtoData(ig.medido_em)}` : ""}
          </p>
        </div>
      </footer>
    </div>
  );
}
