// O trabalho da Mantora no período, a partir das tarefas do ClickUp do cliente:
// o que ficou pronto, o que está em andamento e o que vem a seguir, e a contagem do que foi produzido.
// Funções puras (sem rede), para dar para testar com tarefas de exemplo.

import { dataBrasilia, fimDoMes, somaDias } from "./calc";
import type { TarefaClickup, TipoPeriodo, TrabalhoPeriodo } from "./tipos";

/** Status de tarefa pronta (o ClickUp da Mantora usa "finalizado"; nem sempre o tipo vem como fechado). */
const PRONTA = /finaliz|conclu|complet|closed|entregue|publicad/i;
/** Tarefas que não entram no relatório. */
const FORA = /cancel|arquiv|stand ?by|pausad|descart/i;
/** Ainda não começou. */
const NAO_COMECOU = /^(pendente|a fazer|to ?do|open|aberto|backlog|novo|nova|não iniciad)/i;

export interface TarefaBruta {
  nome: string;
  lista: string;
  status: string;
  fechada: boolean;
  /** Prazo e última atualização em milissegundos (como o ClickUp devolve). */
  prazo: number | null;
  atualizada: number;
}

const dia = (ms: number | null) => (ms === null ? null : dataBrasilia(new Date(ms)));

/** Último dia da janela "o que vem a seguir": a próxima semana ou o próximo mês. */
export function fimDoProximo(tipo: TipoPeriodo, fim: string): string {
  return tipo === "mes" ? fimDoMes(somaDias(fim, 1)) : somaDias(fim, 7);
}

/**
 * Separa as tarefas do cliente em feitas no período, em andamento (agora) e próximas.
 * - Feita: status pronto e prazo no período; sem prazo no período, atualizada dentro dele com prazo recente
 *   (atualização em massa de tarefa antiga não conta).
 * - Próxima: ainda não começou e tem prazo depois do período (até o fim da próxima semana ou do próximo mês).
 * - Em andamento: aberta, mexida nos últimos 30 dias e já começada, ou com prazo até o fim do período.
 */
export function separarTarefas(tarefas: TarefaBruta[], tipo: TipoPeriodo, inicio: string, fim: string): Omit<TrabalhoPeriodo, "em"> {
  const fimProx = fimDoProximo(tipo, fim);
  const recente = somaDias(inicio, -30);
  const feitas: TarefaClickup[] = [];
  const andamento: TarefaClickup[] = [];
  const proximas: TarefaClickup[] = [];
  const vistos = new Set<string>();
  for (const t of tarefas) {
    const nome = t.nome.replace(/\s+/g, " ").trim();
    if (!nome || FORA.test(t.status)) continue;
    const chave = `${nome.toLowerCase()}|${t.lista.toLowerCase()}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    const prazo = dia(t.prazo);
    const atualizada = dia(t.atualizada) as string;
    const resumo: TarefaClickup = { nome, lista: t.lista.trim(), status: t.status, prazo };
    if (t.fechada || PRONTA.test(t.status)) {
      // Sem data de conclusão confiável (o "finalizado" da Mantora não fecha a tarefa), vale o prazo quando ele cai no período;
      // fora disso, a última atualização dentro do período (e prazo recente, para não contar atualização em massa).
      const noPeriodo = (d: string | null) => d !== null && d >= inicio && d <= fim;
      if (noPeriodo(prazo) || (noPeriodo(atualizada) && (prazo === null || prazo >= somaDias(inicio, -21)))) feitas.push(resumo);
      continue;
    }
    if (atualizada < recente && (prazo === null || prazo < inicio)) continue; // parada há muito tempo
    const naoComecou = NAO_COMECOU.test(t.status);
    if (naoComecou && prazo !== null && prazo > fim) {
      if (prazo <= fimProx) proximas.push(resumo);
      continue;
    }
    if (prazo !== null && prazo < somaDias(inicio, -30)) continue;
    if (naoComecou && prazo === null) continue;
    andamento.push(resumo);
  }
  const porPrazo = (a: TarefaClickup, b: TarefaClickup) => (a.prazo ?? "9").localeCompare(b.prazo ?? "9");
  return { feitas: feitas.sort(porPrazo), andamento: andamento.sort(porPrazo), proximas: proximas.sort(porPrazo), producao: producao(feitas) };
}

// ---------- O que foi produzido, por tipo ----------

interface Categoria {
  chave: string;
  singular: string;
  plural: string;
}

const C = {
  video: { chave: "video", singular: "vídeo editado", plural: "vídeos editados" },
  texto: { chave: "texto", singular: "roteiro ou texto escrito", plural: "roteiros e textos escritos" },
  carrossel: { chave: "carrossel", singular: "carrossel criado", plural: "carrosséis criados" },
  arte: { chave: "arte", singular: "arte criada", plural: "artes criadas" },
  destaque: { chave: "destaque", singular: "capa de destaque", plural: "capas de destaque" },
  anuncio: { chave: "anuncio", singular: "anúncio criado", plural: "anúncios criados" },
  pagina: { chave: "pagina", singular: "página criada ou ajustada", plural: "páginas criadas ou ajustadas" },
  email: { chave: "email", singular: "e-mail escrito", plural: "e-mails escritos" },
  campanha: { chave: "campanha", singular: "campanha configurada", plural: "campanhas configuradas" },
  automacao: { chave: "automacao", singular: "automação", plural: "automações" },
} satisfies Record<string, Categoria>;

/** Em que categoria a tarefa entra (null quando é trabalho interno ou não dá para dizer). */
export function categoria(t: Pick<TarefaClickup, "nome" | "lista">): Categoria | null {
  const n = t.nome.toLowerCase();
  const l = t.lista.toLowerCase();
  if (/destaque/.test(n)) return C.destaque;
  if (/an[uú]ncio|criativo/.test(n)) return C.anuncio;
  if (/e[-\u2011]?mails?\b/.test(n)) return C.email;
  if (/p[aá]gina|landing|\blp\b|\bsite\b|checkout/.test(n)) return C.pagina;
  if (/automa[cç]|fluxo|integra[cç]/.test(n)) return C.automacao;
  if (/campanha/.test(n)) return C.campanha;
  // Na lista de calendário/copy, o conteúdo é escrito; na de edição, é o vídeo editado.
  if (/calend[aá]rio|copy|conte[uú]do|roteiro/.test(l)) return C.texto;
  if (/edi[cç][aã]o|v[ií]deo/.test(l)) return C.video;
  if (/reels?\b|v[ií]deo|\btake\b|remix|caixinha|youtube|\bcorte/.test(n)) return C.video;
  if (/carross?el/.test(n)) return C.carrossel;
  if (/imagem|\barte|\bpost\b|stor(y|ies)|linkedin|design/.test(n)) return C.arte;
  if (/roteiro|cop(y|ies)|legenda|\btexto/.test(n)) return C.texto;
  return null;
}

/** "Design de 05 anúncios" conta 5; o resto conta 1. */
export function quantidade(nome: string): number {
  const m = /(\d{1,2})\s*(?:an[uú]ncios?|criativos?|e[-\u2011]?mails?|v[ií]deos?|reels|roteiros?|cop(?:y|ies)|artes?|imagens?|carross[eé]is|p[aá]ginas?|posts?)/i.exec(nome);
  const n = m ? Number(m[1]) : 1;
  return n >= 1 && n <= 50 ? n : 1;
}

/** Contagem do que ficou pronto, por tipo, do maior para o menor. */
export function producao(feitas: TarefaClickup[]): TrabalhoPeriodo["producao"] {
  const total = new Map<string, { cat: Categoria; n: number }>();
  for (const t of feitas) {
    const cat = categoria(t);
    if (!cat) continue;
    const atual = total.get(cat.chave) ?? { cat, n: 0 };
    atual.n += quantidade(t.nome);
    total.set(cat.chave, atual);
  }
  return [...total.values()]
    .sort((a, b) => b.n - a.n)
    .map(({ cat, n }) => ({ rotulo: n === 1 ? cat.singular : cat.plural, total: n }));
}
