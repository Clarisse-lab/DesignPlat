// Contas do relatório do cliente, sem acesso a banco (testáveis): períodos, escolha da coleta, somas,
// comparação, o "normal" do perfil e os recordes.
// Semana = segunda a domingo; mês = do dia 1 ao último dia. Horário de Brasília (UTC-3, sem horário de verão).

import type { Historico, Kpi, Marco, PostSemana, TipoPeriodo } from "./tipos";

const DIA = 86_400_000;
const OFFSET = -3 * 3600_000;

/** "2026-11-02" a partir de um instante, no fuso de Brasília. */
export function dataBrasilia(at: Date): string {
  return new Date(at.getTime() + OFFSET).toISOString().slice(0, 10);
}

export function somaDias(data: string, dias: number): string {
  return new Date(Date.parse(`${data}T00:00:00Z`) + dias * DIA).toISOString().slice(0, 10);
}

/** Segunda-feira da semana de uma data (YYYY-MM-DD). */
export function segunda(data: string): string {
  const dow = new Date(`${data}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return somaDias(data, dow === 0 ? -6 : 1 - dow);
}

/** Última semana completa (segunda a domingo) antes de `agora`. */
export function ultimaSemanaCompleta(agora: Date = new Date()): { inicio: string; fim: string } {
  const inicio = somaDias(segunda(dataBrasilia(agora)), -7);
  return { inicio, fim: somaDias(inicio, 6) };
}

/** Semanas completas mais recentes (a primeira é a última completa). */
export function semanasRecentes(qtd: number, agora: Date = new Date()): { inicio: string; fim: string }[] {
  const { inicio } = ultimaSemanaCompleta(agora);
  return Array.from({ length: qtd }, (_, i) => {
    const ini = somaDias(inicio, -7 * i);
    return { inicio: ini, fim: somaDias(ini, 6) };
  });
}

/** Último dia do mês de uma data. */
export function fimDoMes(data: string): string {
  const [a, m] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
}

/** Último mês completo antes de `agora`. */
export function ultimoMesCompleto(agora: Date = new Date()): { inicio: string; fim: string } {
  const hoje = dataBrasilia(agora);
  const fim = somaDias(`${hoje.slice(0, 7)}-01`, -1);
  return { inicio: `${fim.slice(0, 7)}-01`, fim };
}

/** Meses completos mais recentes (o primeiro é o último completo). */
export function mesesRecentes(qtd: number, agora: Date = new Date()): { inicio: string; fim: string }[] {
  const lista: { inicio: string; fim: string }[] = [];
  let atual = ultimoMesCompleto(agora);
  for (let i = 0; i < qtd; i++) {
    lista.push(atual);
    const fim = somaDias(atual.inicio, -1);
    atual = { inicio: `${fim.slice(0, 7)}-01`, fim };
  }
  return lista;
}

/** Períodos recentes do tipo pedido. */
export function periodosRecentes(tipo: TipoPeriodo, qtd: number, agora: Date = new Date()) {
  return tipo === "mes" ? mesesRecentes(qtd, agora) : semanasRecentes(qtd, agora);
}

/** Fim do período a partir do início. */
export function fimDoPeriodo(tipo: TipoPeriodo, inicio: string): string {
  return tipo === "mes" ? fimDoMes(inicio) : somaDias(inicio, 6);
}

/** Período anterior ao informado (semana anterior ou mês anterior). */
export function periodoAnterior(tipo: TipoPeriodo, inicio: string): { inicio: string; fim: string } {
  const fim = somaDias(inicio, -1);
  return tipo === "mes" ? { inicio: `${fim.slice(0, 7)}-01`, fim } : { inicio: somaDias(inicio, -7), fim };
}

/** Início válido do período: segunda-feira (semana) ou dia 1 (mês). */
export function inicioValido(tipo: TipoPeriodo, inicio: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return false;
  return tipo === "mes" ? inicio.endsWith("-01") : new Date(`${inicio}T12:00:00Z`).getUTCDay() === 1;
}

/** Intervalo em instantes UTC: [início 00h, dia seguinte ao fim 00h) no horário de Brasília. Sem fim, uma semana. */
export function intervaloUtc(inicio: string, fim: string = somaDias(inicio, 6)): { de: string; ate: string } {
  const de = new Date(Date.parse(`${inicio}T00:00:00Z`) - OFFSET).toISOString();
  const ate = new Date(Date.parse(`${somaDias(fim, 1)}T00:00:00Z`) - OFFSET).toISOString();
  return { de, ate };
}

/**
 * Data de coleta usada para medir os posts de uma semana: a primeira coleta depois do domingo
 * (as coletas são semanais, às segundas). Sem coleta depois, usa a mais recente (relatório parcial).
 */
export function coletaDaSemana(fim: string, coletas: string[]): { data: string | null; parcial: boolean } {
  const ordenadas = [...new Set(coletas)].sort();
  const depois = ordenadas.find((d) => d > fim);
  if (depois) return { data: depois, parcial: false };
  return { data: ordenadas.at(-1) ?? null, parcial: true };
}

/** Seguidores numa data: o ponto mais recente até `data` (+1 dia de folga), somando as contas. */
export function seguidoresEm(pontos: { conta: string; data: string; seguidores: number }[], data: string): number | null {
  const limite = somaDias(data, 1);
  const porConta = new Map<string, { data: string; seguidores: number }>();
  for (const p of pontos) {
    if (p.data > limite) continue;
    const atual = porConta.get(p.conta);
    if (!atual || p.data > atual.data) porConta.set(p.conta, { data: p.data, seguidores: p.seguidores });
  }
  if (!porConta.size) return null;
  return [...porConta.values()].reduce((s, p) => s + p.seguidores, 0);
}

/** Novos seguidores num período: diferença entre a coleta logo depois do fim e a do começo. */
export function novosSeguidores(pontos: { conta: string; data: string; seguidores: number }[], inicio: string, fim: string): number | null {
  const contas = new Set(pontos.map((p) => p.conta));
  const final = seguidoresEm(pontos, somaDias(fim, 1));
  const inicial = seguidoresEm(pontos, inicio);
  if (final === null || inicial === null) return null;
  // Só vale se as duas pontas vierem de coletas diferentes (senão a diferença é zero por falta de dado).
  const datas = (limite: string) =>
    [...contas].map((c) => pontos.filter((p) => p.conta === c && p.data <= somaDias(limite, 1)).map((p) => p.data).sort().at(-1) ?? "").join();
  if (datas(somaDias(fim, 1)) === datas(inicio)) return null;
  return final - inicial;
}

export function formato(tipo: string, produto: string | null): PostSemana["formato"] {
  if (produto === "REELS") return "Reels";
  if (tipo === "CAROUSEL_ALBUM") return "Carrossel";
  if (tipo === "VIDEO") return "Vídeo";
  return "Foto";
}

const soma = (lista: PostSemana[], campo: keyof Pick<PostSemana, "alcance" | "interacoes" | "salvamentos" | "compartilhamentos" | "visualizacoes">) => {
  const valores = lista.map((p) => p[campo]).filter((v): v is number => typeof v === "number");
  return valores.length ? valores.reduce((a, b) => a + b, 0) : null;
};

export function totais(lista: PostSemana[]) {
  const salvos = soma(lista, "salvamentos");
  const compart = soma(lista, "compartilhamentos");
  return {
    posts: lista.length,
    alcance: soma(lista, "alcance"),
    interacoes: soma(lista, "interacoes"),
    visualizacoes: soma(lista, "visualizacoes"),
    salvos_compart: salvos === null && compart === null ? null : (salvos ?? 0) + (compart ?? 0),
  };
}

/** Nota de conteúdo: salvamentos + compartilhamentos por mil de alcance (a mesma da aba Desempenho). */
export function nota(p: Pick<PostSemana, "alcance" | "salvamentos" | "compartilhamentos">): number {
  if (!p.alcance || p.alcance < 50) return 0;
  return (((p.salvamentos ?? 0) + (p.compartilhamentos ?? 0)) * 1000) / p.alcance;
}

/** Os 3 melhores posts: metade do peso no alcance, metade na nota (o que foi visto e o que foi guardado). */
export function melhores(lista: PostSemana[], qtd = 3): string[] {
  if (!lista.length) return [];
  const maxAlcance = Math.max(1, ...lista.map((p) => p.alcance ?? 0));
  const maxNota = Math.max(1e-9, ...lista.map(nota));
  return [...lista]
    .map((p) => ({ id: p.media_id, score: (p.alcance ?? 0) / maxAlcance + nota(p) / maxNota }))
    .sort((a, b) => b.score - a.score)
    .slice(0, qtd)
    .map((x) => x.id);
}

export function porFormato(lista: PostSemana[]) {
  const mapa = new Map<string, { formato: string; posts: number; alcance: number }>();
  for (const p of lista) {
    const atual = mapa.get(p.formato) ?? { formato: p.formato, posts: 0, alcance: 0 };
    atual.posts++;
    atual.alcance += p.alcance ?? 0;
    mapa.set(p.formato, atual);
  }
  return [...mapa.values()].sort((a, b) => b.alcance - a.alcance);
}

export const kpi = (valor: number | null, anterior: number | null): Kpi => ({ valor, anterior });

/** Variação em % (null quando não dá para comparar). */
export function variacao(k: Kpi): number | null {
  if (k.valor === null || k.anterior === null || k.anterior === 0) return null;
  return Math.round(((k.valor - k.anterior) / Math.abs(k.anterior)) * 1000) / 10;
}

// ---------- O normal do perfil, recordes e posts acima e abaixo do normal ----------

const mediana = (valores: number[]): number | null => {
  const v = valores.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
};

const engajamento = (p: Pick<PostSemana, "alcance" | "interacoes">) =>
  p.alcance && p.alcance >= 50 && p.interacoes !== null ? (p.interacoes / p.alcance) * 100 : null;

/** O normal do perfil a partir dos posts anteriores ao período (com as métricas mais recentes de cada um). */
export function historico(base: PostSemana[], desde: string): Historico | null {
  const validos = base.filter((p) => p.alcance !== null && p.alcance > 0);
  if (validos.length < 5) return null;
  return {
    desde,
    posts: validos.length,
    mediana_alcance: mediana(validos.map((p) => p.alcance as number)),
    mediana_salvos_compart: mediana(validos.map((p) => (p.salvamentos ?? 0) + (p.compartilhamentos ?? 0))),
    mediana_engajamento: mediana(validos.map(engajamento).filter((x): x is number => x !== null)),
  };
}

/**
 * Posts acima e abaixo do normal (alcance ≥ 1,5x ou ≤ 0,6x a mediana), do mais forte ao mais fraco.
 * Com `medidoEm`, post com menos de 3 dias na data da medição não entra em "abaixo": ainda está ganhando alcance.
 */
export function acimaAbaixo(lista: PostSemana[], h: Historico | null, medidoEm: string | null = null): { acima: string[]; abaixo: string[] } {
  if (!h?.mediana_alcance) return { acima: [], abaixo: [] };
  const m = h.mediana_alcance;
  const comAlcance = lista.filter((p) => p.alcance !== null);
  const maduro = (p: PostSemana) => !medidoEm || dataBrasilia(new Date(p.publicado_em)) <= somaDias(medidoEm, -3);
  return {
    acima: comAlcance.filter((p) => (p.alcance as number) >= 1.5 * m).sort((a, b) => (b.alcance as number) - (a.alcance as number)).map((p) => p.media_id),
    abaixo: comAlcance.filter((p) => (p.alcance as number) <= 0.6 * m && maduro(p)).sort((a, b) => (a.alcance as number) - (b.alcance as number)).map((p) => p.media_id),
  };
}

const fmt = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`
    : Math.abs(n) >= 10_000
      ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`
      : Math.round(n).toLocaleString("pt-BR");
const vezes = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x`;
const dataCurta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const assunto = (p: PostSemana) => {
  const limpo = p.legenda.replace(/[^\p{L}\p{N}\s,.!?'"-]/gu, "").replace(/\s+/g, " ").trim();
  const frase = limpo.split(/(?<=[.!?])\s/)[0] ?? limpo;
  return frase.length > 70 ? `${frase.slice(0, 67).trimEnd()}…` : frase;
};

/**
 * Momentos do período (estilo retrospectiva): recordes e comparações com o normal do próprio perfil.
 * `anteriores` = totais de alcance dos períodos anteriores (do mais recente para o mais antigo), pela data de publicação.
 * Só entra o que for verdade e chamar atenção; no máximo 4.
 */
export function marcos(input: {
  tipo: TipoPeriodo;
  lista: PostSemana[];
  base: PostSemana[];
  historico: Historico | null;
  anteriores: { inicio: string; alcance: number }[];
  novos_seguidores: number | null;
}): Marco[] {
  const { lista, base, historico: h, tipo } = input;
  const mes = tipo === "mes";
  const doPeriodo = mes ? "do mês" : "da semana";
  const noPeriodo = mes ? "no mês" : "na semana";
  const nestePeriodo = mes ? "neste mês" : "nesta semana";
  const oPeriodo = mes ? "O mês" : "A semana";
  const qualquer = mes ? "qualquer mês" : "qualquer semana";
  const desdeP = (d: string) => (mes ? `desde ${["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][Number(d.slice(5, 7)) - 1]}` : `desde ${dataCurta(d)}`);
  const saida: Marco[] = [];
  const comAlcance = lista.filter((p) => p.alcance !== null) as (PostSemana & { alcance: number })[];
  if (!comAlcance.length) return saida;

  // 1. Post mais visto: recorde no histórico ou quantas vezes o normal.
  const top = comAlcance.reduce((a, b) => (b.alcance > a.alcance ? b : a));
  const maxBase = Math.max(0, ...base.map((p) => p.alcance ?? 0));
  if (h && base.length >= 5 && top.alcance > maxBase) {
    saida.push({
      titulo: `Seu post mais visto desde ${dataCurta(h.desde)}`,
      valor: fmt(top.alcance),
      texto: `"${assunto(top)}" alcançou ${fmt(top.alcance)} pessoas${h.mediana_alcance ? `, ${vezes(top.alcance / h.mediana_alcance)} o normal de um post seu` : ""}.`,
      media_id: top.media_id,
    });
  } else if (h?.mediana_alcance && top.alcance >= 2 * h.mediana_alcance) {
    saida.push({
      titulo: `${vezes(top.alcance / h.mediana_alcance)} o alcance normal de um post seu`,
      valor: fmt(top.alcance),
      texto: `"${assunto(top)}" foi o destaque ${doPeriodo}: ${fmt(top.alcance)} pessoas alcançadas.`,
      media_id: top.media_id,
    });
  }

  // 2. Alcance total do período comparado com os períodos anteriores.
  const total = comAlcance.reduce((s, p) => s + p.alcance, 0);
  const anteriores = input.anteriores.filter((a) => a.alcance > 0);
  if (anteriores.length >= 3) {
    const maior = anteriores.find((a) => a.alcance >= total);
    if (!maior) {
      saida.push({
        titulo: `${oPeriodo} de maior alcance ${desdeP(anteriores.at(-1)!.inicio)}`,
        valor: fmt(total),
        texto: `Os conteúdos publicados ${nestePeriodo} somaram ${fmt(total)} de alcance, mais que ${qualquer} ${desdeP(anteriores.at(-1)!.inicio)}.`,
      });
    } else {
      const indice = anteriores.indexOf(maior);
      if (indice >= 2) {
        saida.push({
          titulo: `${oPeriodo} de maior alcance ${desdeP(maior.inicio)}`,
          valor: fmt(total),
          texto: `É o melhor resultado das últimas ${indice + 1} ${tipo === "mes" ? "meses" : "semanas"}.`,
        });
      }
    }
  }

  // 3. Post mais salvo e compartilhado (o conteúdo que as pessoas guardam e mandam para alguém).
  const guardado = comAlcance.reduce((a, b) => ((b.salvamentos ?? 0) + (b.compartilhamentos ?? 0) > (a.salvamentos ?? 0) + (a.compartilhamentos ?? 0) ? b : a));
  const sc = (guardado.salvamentos ?? 0) + (guardado.compartilhamentos ?? 0);
  if (h?.mediana_salvos_compart && sc >= 3 * h.mediana_salvos_compart && guardado.media_id !== saida[0]?.media_id) {
    saida.push({
      titulo: "O conteúdo que mais gente guardou e compartilhou",
      valor: fmt(sc),
      texto: `"${assunto(guardado)}" foi salvo ou enviado ${fmt(sc)} vezes, ${vezes(sc / h.mediana_salvos_compart)} o normal do perfil.`,
      media_id: guardado.media_id,
    });
  }

  // 4. Engajamento do período acima do normal.
  const engs = comAlcance.map(engajamento).filter((x): x is number => x !== null);
  const engPeriodo = mediana(engs);
  if (h?.mediana_engajamento && engPeriodo && engPeriodo >= 1.25 * h.mediana_engajamento) {
    saida.push({
      titulo: "Público mais engajado que o normal",
      valor: `${engPeriodo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`,
      texto: `De cada 100 pessoas alcançadas, ${engPeriodo.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} interagiram com o post típico ${doPeriodo}. O normal do perfil é ${h.mediana_engajamento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}.`,
    });
  }

  // 5. Crescimento de seguidores (só quando é alto em relação ao tamanho do perfil fica para a IA; aqui só se for grande).
  if (input.novos_seguidores && input.novos_seguidores >= 1000) {
    saida.push({
      titulo: `Novos seguidores ${noPeriodo}`,
      valor: `+${fmt(input.novos_seguidores)}`,
      texto: `${fmt(input.novos_seguidores)} pessoas novas passaram a acompanhar o perfil.`,
    });
  }
  return saida.slice(0, 4);
}

/** Soma o alcance dos posts por período (semana ou mês) de publicação, para comparar com o atual. */
export function alcancePorPeriodo(tipo: TipoPeriodo, base: PostSemana[], inicioAtual: string, qtd: number): { inicio: string; alcance: number }[] {
  const periodos: { inicio: string; fim: string; alcance: number }[] = [];
  let p = periodoAnterior(tipo, inicioAtual);
  for (let i = 0; i < qtd; i++) {
    periodos.push({ ...p, alcance: 0 });
    p = periodoAnterior(tipo, p.inicio);
  }
  for (const post of base) {
    const dia = dataBrasilia(new Date(post.publicado_em));
    const alvo = periodos.find((x) => dia >= x.inicio && dia <= x.fim);
    if (alvo) alvo.alcance += post.alcance ?? 0;
  }
  // Só os períodos que já têm algum post medido (antes da primeira coleta não há dado).
  const ultimoComDado = periodos.map((x) => x.alcance > 0).lastIndexOf(true);
  return periodos.slice(0, ultimoComDado + 1).map(({ inicio, alcance }) => ({ inicio, alcance }));
}
