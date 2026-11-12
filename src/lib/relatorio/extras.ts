// Dados extras do relatório: números da conta, público, nicho, o que depende do cliente, comentários
// e o "antes e depois". Funções puras (sem rede), para testar com respostas de exemplo da API.

import { trafegoEfetivo } from "./meta";
import type { AntesDepois, CardPeriodo, ContaIg, DadosSemana, Kpi, Nicho, Pendencia, PostSemana, Publico, TrafegoSemana } from "./tipos";

// ---------- Conta ----------

/** Números da conta vindos da função instagram-conta (nomes da Graph API). */
export function contaIgDe(n: Record<string, number> | null | undefined): ContaIg | null {
  if (!n || n.reach === undefined) return null;
  return {
    alcance: n.reach ?? 0,
    visualizacoes: n.views ?? 0,
    engajadas: n.accounts_engaged ?? 0,
    interacoes: n.total_interactions ?? 0,
    seguiram: n.seguiram ?? null,
    deixaram: n.deixaram ?? null,
  };
}

/** Taxa de engajamento da conta: quem interagiu sobre quem foi alcançado (%). */
export function taxaEngajamento(c: ContaIg | null | undefined): number | null {
  if (!c || c.alcance <= 0) return null;
  return Math.round((c.engajadas / c.alcance) * 1000) / 10;
}

// ---------- Público ----------

type Quebra = { chave: string; valor: number }[];
const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
const ORDEM_IDADE = ["13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

export function publicoDe(r: { idade?: Quebra; genero?: Quebra; cidade?: Quebra } | null | undefined): Publico | null {
  if (!r?.idade?.length) return null;
  const totalIdade = r.idade.reduce((t, x) => t + x.valor, 0);
  const totalGenero = (r.genero ?? []).reduce((t, x) => t + x.valor, 0);
  const g = (k: string) => (totalGenero ? pct((r.genero ?? []).find((x) => x.chave === k)?.valor ?? 0, totalGenero) : null);
  // A quebra por cidade só traz as maiores; a porcentagem é sobre o total de seguidores contados por idade.
  const cidades = (r.cidade ?? []).slice(0, 5).map((c) => ({ cidade: c.chave.replace(/,\s*.*$/, ""), pct: pct(c.valor, totalIdade) }));
  return {
    idade: [...r.idade]
      .sort((a, b) => ORDEM_IDADE.indexOf(a.chave) - ORDEM_IDADE.indexOf(b.chave))
      .filter((x) => ORDEM_IDADE.includes(x.chave))
      .map((x) => ({ faixa: x.chave, pct: pct(x.valor, totalIdade) })),
    mulheres: g("F"),
    homens: g("M"),
    cidades,
  };
}

// ---------- Nicho ----------

/**
 * Compara o engajamento público do cliente com o dos perfis do nicho, pela mesma régua
 * (curtidas + comentários por post, sobre os seguidores). Perfis com curtidas escondidas (engajamento 0 ou nulo) ficam de fora.
 */
export function nichoDe(
  perfis: { perfil: string; seguidores?: number; engajamento?: number | null; erro?: string }[],
  usuarioCliente: string,
): Nicho | null {
  if (!perfis.length) return null;
  const valido = (p: (typeof perfis)[number]) => !p.erro && typeof p.engajamento === "number" && p.engajamento > 0 && (p.seguidores ?? 0) > 0;
  const fora = perfis.filter((p) => !valido(p)).map((p) => ({ perfil: p.perfil, motivo: p.erro ?? "sem curtidas nos posts" }));
  const validos = perfis.filter(valido);
  const cli = validos.find((p) => p.perfil.toLowerCase() === usuarioCliente.toLowerCase());
  const outros = validos.filter((p) => p !== cli);
  const media = outros.length ? Math.round((outros.reduce((t, p) => t + (p.engajamento as number), 0) / outros.length) * 100) / 100 : null;
  // Sem o cliente (curtidas escondidas) ou com menos de 3 perfis, não há comparação justa: a seção não aparece.
  const ok = Boolean(cli) && outros.length >= 3 && media !== null;
  const acima = ok ? outros.filter((p) => (p.engajamento as number) > (cli!.engajamento as number)).length : 0;
  return {
    cliente: ok ? (cli!.engajamento as number) : null,
    media: ok ? media : null,
    vezes: ok && media! > 0 ? Math.round(((cli!.engajamento as number) / media!) * 10) / 10 : null,
    // Posição entre todos (o cliente incluído): 1º de 40 = entre os 3% com mais engajamento.
    topo_pct: ok ? Math.max(1, Math.ceil(((acima + 1) / (outros.length + 1)) * 100)) : null,
    total: outros.length,
    perfis: outros.map((p) => ({ perfil: p.perfil, seguidores: p.seguidores as number, engajamento: p.engajamento as number })),
    fora,
  };
}

// ---------- O que depende do cliente ----------

const TIPOS: [RegExp, string][] = [
  [/reels?\b|v[ií]deo|\btake\b|remix|caixinha/i, "Vídeo"],
  [/carross?el/i, "Carrossel"],
  [/imagem|arte|\bpost\b|stor(y|ies)/i, "Post"],
  [/an[uú]ncio|criativo/i, "Anúncio"],
  [/p[aá]gina|landing|site/i, "Página"],
  [/grava/i, "Gravação"],
];

/**
 * Título de tarefa do ClickUp para o cliente ler: tira o nome do cliente e o tipo do começo
 * ("Bruna Reels | Inseminação" vira tipo Vídeo e título "Inseminação").
 */
export function limparTitulo(nome: string, nomeCliente: string): { tipo: string; titulo: string } {
  const partes = nome.split("|").map((p) => p.trim()).filter(Boolean);
  const tipo = TIPOS.find(([re]) => re.test(partes.length > 1 ? partes[0] : nome))?.[1] ?? "Projeto";
  let titulo = partes.length > 1 ? partes[partes.length - 1] : nome;
  const primeiro = nomeCliente.split(/\s+/).find((p) => p.length > 2 && !/^(dra?|sr|sra)\.?$/i.test(p)) ?? "";
  if (primeiro) titulo = titulo.replace(new RegExp(`^${primeiro}\\s*[-–:]\\s*`, "i"), "");
  titulo = titulo.replace(/\s+/g, " ").trim();
  return { tipo, titulo: titulo.charAt(0).toUpperCase() + titulo.slice(1) };
}

export function pendenciasDe(
  tarefas: { nome: string; atualizada: number | null }[],
  aprovacoes: { titulo: string; criado_em: string; link: string }[],
  nomeCliente: string,
): Pendencia[] {
  const dia = (ms: number | null) => (ms ? new Date(ms - 3 * 3600_000).toISOString().slice(0, 10) : null);
  return [
    ...aprovacoes.map((a) => ({ titulo: a.titulo, tipo: "Aprovação", desde: a.criado_em.slice(0, 10), link: a.link })),
    ...tarefas.map((t) => ({ ...limparTitulo(t.nome, nomeCliente), desde: dia(t.atualizada), link: null })),
  ].sort((a, b) => (a.desde ?? "").localeCompare(b.desde ?? ""));
}

// ---------- Comentários ----------

/** Comentários que podem virar "palavras que aqueceram": com texto de verdade, sem contato pessoal. */
export function comentariosCandidatos(lista: { media_id: string; texto: string; curtidas: number }[]) {
  const vistos = new Set<string>();
  return lista
    .map((c) => ({ ...c, texto: c.texto.replace(/@\w[\w.]*/g, "").replace(/\s+/g, " ").trim() }))
    .filter((c) => {
      const letras = c.texto.replace(/[^\p{L}]/gu, "");
      if (letras.length < 12) return false; // emoji, "top", "amei"
      if (/\d{4,}|@|https?:|www\.|\.com/i.test(c.texto)) return false; // telefone, e-mail, link
      const k = c.texto.toLowerCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .sort((a, b) => b.curtidas - a.curtidas || b.texto.length - a.texto.length)
    .slice(0, 60);
}

// ---------- Leitura dos números ----------

export type Tom = "bom" | "normal" | "atencao";

/** Se o número foi bom, habitual ou abaixo para este cliente, comparado com o típico dele. */
export function leitura(valor: number | null, tipico: number | null, inverso = false): { tom: Tom; texto: string } | null {
  if (valor === null || tipico === null || tipico <= 0) return null;
  const r = valor / tipico;
  const acima = inverso ? r <= 0.85 : r >= 1.15;
  const abaixo = inverso ? r >= 1.15 : r <= 0.85;
  if (acima) return { tom: "bom", texto: inverso ? "melhor que o seu normal" : "acima do seu normal" };
  if (abaixo) return { tom: "atencao", texto: inverso ? "mais alto que o seu normal" : "abaixo do seu normal" };
  return { tom: "normal", texto: "dentro do seu normal" };
}

/** Mediana de uma lista de números (null se vazia). */
export function mediana(xs: number[]): number | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export const kpiDe = (valor: number | null, anterior: number | null): Kpi => ({ valor, anterior });

// ---------- Antes e depois ----------

/** Primeiro mês acompanhado contra o período atual (mediana por post). Precisa de pelo menos 5 posts em cada lado. */
export function antesDepois(base: PostSemana[], atual: PostSemana[], rotuloAtual: string): AntesDepois | null {
  const ordenados = [...base].filter((p) => p.alcance !== null).sort((a, b) => a.publicado_em.localeCompare(b.publicado_em));
  if (!ordenados.length) return null;
  const inicio = new Date(ordenados[0].publicado_em).getTime();
  const primeiros = ordenados.filter((p) => new Date(p.publicado_em).getTime() < inicio + 30 * 864e5);
  const agora = atual.filter((p) => p.alcance !== null);
  if (primeiros.length < 5 || agora.length < 5) return null;
  const resumo = (l: PostSemana[]) => ({
    mediana_alcance: mediana(l.map((p) => p.alcance as number)),
    mediana_salvos_compart: mediana(l.map((p) => (p.salvamentos ?? 0) + (p.compartilhamentos ?? 0))),
    posts: l.length,
  });
  const melhores = (l: PostSemana[]) => [...l].sort((a, b) => (b.alcance as number) - (a.alcance as number)).slice(0, 3).map((p) => p.media_id);
  const d = new Date(ordenados[0].publicado_em);
  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return {
    antes: { rotulo: `${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`, ...resumo(primeiros) },
    depois: { rotulo: rotuloAtual, ...resumo(agora) },
    capas_antes: melhores(primeiros),
    capas_depois: melhores(agora),
  };
}

/** O "antes e depois" só aparece quando melhorou (alcance ou salvos/compartilhamentos por post 10% maiores). */
export function antesDepoisMelhorou(ad: AntesDepois | null | undefined): boolean {
  if (!ad) return false;
  const subiu = (a: number | null, d: number | null) => a !== null && d !== null && a > 0 && d >= a * 1.1;
  return subiu(ad.antes.mediana_alcance, ad.depois.mediana_alcance) || subiu(ad.antes.mediana_salvos_compart, ad.depois.mediana_salvos_compart);
}

// ---------- Para o link do cliente ----------

/** Os 3 números do card de um relatório: alcance, seguidores novos e o principal resultado de negócio que houver. */
export function numerosDoCard(dados: DadosSemana, manual: TrafegoSemana | null | undefined): NonNullable<CardPeriodo["numeros"]> {
  const n: NonNullable<CardPeriodo["numeros"]> = [];
  const alcance = dados.conta_ig?.atual.alcance ?? dados.instagram?.alcance.valor ?? null;
  if (alcance) n.push({ rotulo: "alcance", valor: alcance });
  const seguiram = dados.conta_ig?.atual.seguiram ?? dados.instagram?.novos_seguidores.valor ?? null;
  if (seguiram) n.push({ rotulo: "seguidores", valor: seguiram });
  const t = trafegoEfetivo(dados, manual);
  const leads = (dados.leads?.total.valor ?? 0) || t.leads || 0;
  if (t.vendas) n.push({ rotulo: "vendas", valor: t.vendas });
  else if (leads) n.push({ rotulo: "leads", valor: leads });
  else if (t.conversas) n.push({ rotulo: "conversas", valor: t.conversas });
  else if (dados.instagram?.interacoes.valor) n.push({ rotulo: "interações", valor: dados.instagram.interacoes.valor });
  return n.slice(0, 3);
}

/** O que do relatório vai para o link do cliente: sem as listas internas (tarefas, contas, comentários, nomes do nicho). */
export function dadosParaCliente(d: DadosSemana): DadosSemana {
  return {
    ...d,
    meta_ads: d.meta_ads ? { ...d.meta_ads, contas: [] } : null,
    trabalho: d.trabalho ? { ...d.trabalho, feitas: [], andamento: [], proximas: [] } : null,
    comentarios: [],
    nicho: d.nicho?.cliente != null ? { ...d.nicho, perfis: [], fora: [] } : null,
  };
}
