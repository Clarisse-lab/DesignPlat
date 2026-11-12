import "server-only";
// Textos do relatório do cliente (semanal ou mensal): frase, resumo, destaques, o que funcionou e o que ajustar,
// o trabalho da Mantora (feito, em andamento, próximos passos).
// A IA só usa os números que recebe; a equipe revisa tudo antes de publicar.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { variacao } from "../relatorio/calc";
import { anteriorDoMeta, trafegoEfetivo } from "../relatorio/meta";
import type { DadosSemana, Kpi, PostSemana, TextosSemana, TrafegoSemana } from "../relatorio/tipos";
import { CAROUSEL_MODEL, PRICES } from "./carousel-from-copy";
import { anthropic, GenerationError } from "./claude";

const textosSchema = z.object({
  titulo: z.string().describe("A semana em uma frase, até 80 caracteres, afirmativa e específica"),
  resumo: z.string().describe("2 ou 3 frases curtas com o que a semana entregou de resultado"),
  destaques: z
    .array(z.object({ titulo: z.string().describe("Até 5 palavras"), texto: z.string().describe("1 ou 2 frases com o número que sustenta") }))
    .describe("3 destaques de resultado"),
  proximos: z.array(z.string()).describe("2 a 4 próximos passos, uma frase cada: o que vem a seguir no TRABALHO (com prazo, ex.: 'A estratégia de conteúdo fica pronta na próxima semana') e o que os números pedem"),
  funcionou: z.array(z.string()).describe("2 ou 3 frases: o que funcionou e por quê, a partir dos posts acima do normal e dos momentos"),
  ajustar: z.array(z.string()).describe("1 a 3 frases: o que ficou abaixo do normal e o que vamos fazer diferente. Vazio se nada ficou abaixo"),
  feito: z.array(z.string()).describe("2 a 5 frases curtas com o que a Mantora entregou no período, agrupado (ex.: 'Foram editados 5 vídeos, que já seguiram para a sua aprovação'). Vazio se não veio TRABALHO"),
  palavras: z
    .array(z.string())
    .describe(
      "Até 5 comentários da lista COMENTÁRIOS que aquecem o coração (gratidão, transformação, identificação, elogio sincero), copiados como estão (pode cortar no fim de uma frase). Vazio se nenhum for assim",
    ),
  andamento: z.array(z.string()).describe("1 a 4 frases com o que está em andamento agora (ex.: 'Está em andamento a criação da página de captura'). Vazio se nada"),
});

const SYSTEM = `Você escreve o relatório (semanal ou mensal) que a agência Mantora Lab envia para cada cliente. O cliente quer saber de resultado, andamento, entregas e números, em poucas palavras, e sentir o valor do trabalho, como numa retrospectiva: o número sempre com contexto ("o post mais visto desde setembro", "3x o normal do seu perfil"), para ele não precisar interpretar nada. Escreva em português do Brasil, tom profissional, próximo e confiante, sem jargão de marketing e sem exagero.

REGRAS
- Use só os números e fatos recebidos. Nunca invente número, meta, causa ou entrega. Se um dado não veio, não fale dele.
- No resumo e nos destaques, fale de resultado, não de tarefa: nada de "fizemos reunião", "ajustamos o ClickUp", "revisamos a planilha". O trabalho feito vai em "feito", "andamento" e "proximos".
- Contexto: compare com o normal do próprio perfil (a mediana dos últimos 90 dias) e com o período anterior. Os MOMENTOS já foram calculados e são verdadeiros: use-os no título, no resumo e nos destaques.
- O QUE FUNCIONOU fala dos posts acima do normal (tema, formato, gancho) e por que provavelmente funcionaram. O QUE AJUSTAR fala dos abaixo do normal sem drama, sempre com a ação que vamos tomar.
- Variações: cite a comparação com o período anterior quando ela existir. Queda se diz com franqueza e calma, junto do que vamos fazer a respeito, sem culpar o algoritmo nem o cliente.
- Números por extenso curto e no formato brasileiro (12,4 mil; 1,2 milhão; 18%).
- Próximos passos: concretos e possíveis para a próxima semana, ligados ao que os números mostraram ou às notas da equipe.
- TRABALHO DA MANTORA (tarefas do ClickUp): é o que mostra ao cliente que o trabalho está andando. Agrupe por tipo e conte ("Foram editados 5 vídeos e estão a caminho da sua aprovação", "Está em andamento a criação da página de vendas", "A estratégia de conteúdo fica pronta na próxima semana"). Nunca liste tarefa por tarefa, nunca use o nome da tarefa como está, nunca cite pessoas da equipe, status internos ("alteração design", "pendente") ou atrasos. Deixe de fora trabalho interno (analisar dados, verificar, organizar, reunião, alinhamento), a não ser que vire uma entrega para o cliente. Use as contagens de PRODUZIDO quando existirem.
- Leads: se não vier o bloco de leads, não fale de leads.
- CONTA: "pessoas alcançadas" da conta são pessoas diferentes (não soma dos posts); prefira esse número no resumo quando vier.
- NICHO: se vier, use a comparação no resumo ou num destaque ("2x o engajamento médio de perfis parecidos com o seu"). Nunca cite o nome dos perfis.
- COMENTÁRIOS: escolha só os que um cliente teria orgulho de mostrar. Nada de reclamação, pergunta de preço, pedido de contato, religião, política, nem comentário que exponha a pessoa (doença, diagnóstico, acidente, vida íntima), mesmo que seja carinhoso.
- Sem emoji, sem exclamação em excesso, sem "incrível", "explodiu", "bombou".
- As notas da equipe são contexto interno: use a ideia, nunca copie nome de pessoa, valor de contrato ou assunto interno.`;

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "sem dado" : n.toLocaleString("pt-BR"));
function linhaPost(lista: PostSemana[], id: string, mediana: number | null): string {
  const p = lista.find((x) => x.media_id === id);
  if (!p) return "";
  const vs = mediana && p.alcance !== null ? ` (${(p.alcance / mediana).toFixed(1)}x o normal)` : "";
  return `- ${p.formato}: "${p.legenda.slice(0, 120)}" · alcance ${fmt(p.alcance)}${vs} · interações ${fmt(p.interacoes)} · salvamentos ${fmt(p.salvamentos)} · compartilhamentos ${fmt(p.compartilhamentos)}`;
}

const linha = (nome: string, k: Kpi) => {
  const v = variacao(k);
  return `- ${nome}: ${fmt(k.valor)}${k.anterior !== null ? ` (semana anterior: ${fmt(k.anterior)}${v !== null ? `, ${v > 0 ? "+" : ""}${v}%` : ""})` : ""}`;
};

function contexto(input: {
  cliente: string;
  tipo: "semana" | "mes";
  inicio: string;
  fim: string;
  dados: DadosSemana;
  trafego: TrafegoSemana;
  entregas: string[];
  notas: string | null;
}): string {
  const { dados } = input;
  const ig = dados.instagram;
  const nome = input.tipo === "mes" ? "MÊS" : "SEMANA";
  const partes = [`CLIENTE: ${input.cliente}`, `${nome}: ${input.inicio} a ${input.fim} (compare com ${input.tipo === "mes" ? "o mês anterior" : "a semana anterior"})`];
  if (ig) {
    partes.push(
      [
        `INSTAGRAM (@${ig.contas.join(", @")}${ig.parcial ? "; números parciais, a coleta da semana ainda não saiu" : ""})`,
        `- Seguidores: ${fmt(ig.seguidores)}`,
        linha("Novos seguidores", ig.novos_seguidores),
        linha("Posts publicados", ig.posts),
        linha("Alcance somado dos posts", ig.alcance),
        linha("Interações", ig.interacoes),
        linha("Salvamentos + compartilhamentos", ig.salvos_compart),
        linha("Visualizações", ig.visualizacoes),
        ig.formatos.length ? `- Por formato: ${ig.formatos.map((f) => `${f.formato} (${f.posts} posts, alcance ${fmt(f.alcance)})`).join("; ")}` : "",
        ig.historico
          ? `- Normal do perfil (mediana de ${ig.historico.posts} posts desde ${ig.historico.desde}): alcance ${fmt(ig.historico.mediana_alcance)} por post, ${fmt(ig.historico.mediana_salvos_compart)} salvamentos + compartilhamentos por post, engajamento ${ig.historico.mediana_engajamento?.toFixed(1) ?? "sem dado"}%`
          : "- Sem histórico suficiente para dizer o que é normal no perfil",
        ig.melhores.length ? "MELHORES POSTS:" : "",
        ...ig.melhores.map((id) => linhaPost(ig.lista, id, ig.historico?.mediana_alcance ?? null)),
        ig.acima?.length ? "ACIMA DO NORMAL (alcance ≥ 1,5x a mediana):" : "",
        ...(ig.acima ?? []).slice(0, 5).map((id) => linhaPost(ig.lista, id, ig.historico?.mediana_alcance ?? null)),
        ig.abaixo?.length ? "ABAIXO DO NORMAL (alcance ≤ 0,6x a mediana):" : "",
        ...(ig.abaixo ?? []).slice(0, 5).map((id) => linhaPost(ig.lista, id, ig.historico?.mediana_alcance ?? null)),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  const c = dados.conta_ig?.atual;
  if (c) {
    const a = dados.conta_ig?.anterior;
    partes.push(
      `CONTA NO PERÍODO: ${fmt(c.alcance)} pessoas alcançadas${a ? ` (anterior: ${fmt(a.alcance)})` : ""}, ${fmt(c.visualizacoes)} visualizações, ${fmt(c.engajadas)} contas interagiram` +
        (c.seguiram !== null ? `, ${fmt(c.seguiram)} começaram a seguir e ${fmt(c.deixaram ?? 0)} deixaram de seguir` : ""),
    );
  }
  if (dados.nicho) partes.push(`NICHO: engajamento ${fmt(dados.nicho.cliente)}% contra média ${fmt(dados.nicho.media)}% de ${dados.nicho.total} perfis parecidos (${fmt(dados.nicho.vezes)}x); entre os ${dados.nicho.topo_pct}% com mais engajamento`);
  if (dados.publico) partes.push(`PÚBLICO: ${dados.publico.idade.map((x) => `${x.faixa} ${fmt(x.pct)}%`).join(", ")}; mulheres ${fmt(dados.publico.mulheres)}%`);
  if (dados.pendencias?.length) partes.push(`DEPENDEM DO CLIENTE (aparecem numa seção própria; só mencione nos próximos passos se ajudar): ${dados.pendencias.map((p) => p.titulo).join("; ")}`);
  if (dados.comentarios?.length) partes.push(`COMENTÁRIOS:\n${dados.comentarios.slice(0, 40).map((x) => `- ${x.texto.slice(0, 220)}`).join("\n")}`);
  if (dados.marcos?.length) partes.push(`MOMENTOS (calculados, verdadeiros):\n${dados.marcos.map((m) => `- ${m.titulo}: ${m.valor}. ${m.texto}`).join("\n")}`);
  if (dados.leads) {
    partes.push(
      [linha("LEADS NA SEMANA", dados.leads.total), dados.leads.origens.length ? `- Origens: ${dados.leads.origens.map((o) => `${o.origem} ${o.total}`).join(", ")}` : ""].filter(Boolean).join("\n"),
    );
  }
  const t = trafegoEfetivo(dados, input.trafego);
  const ant = (campo: keyof TrafegoSemana, prefixo = "") => {
    const a = anteriorDoMeta(dados, input.trafego, campo);
    return a !== null ? ` (período anterior: ${prefixo}${fmt(a)})` : "";
  };
  const trafego = [
    t.investimento != null && `investimento R$ ${fmt(t.investimento)}${ant("investimento", "R$ ")}`,
    t.leads ? `${fmt(t.leads)} leads${ant("leads")}` : null,
    t.cpl != null && `CPL R$ ${fmt(t.cpl)}${ant("cpl", "R$ ")}`,
    t.vendas != null && `${fmt(t.vendas)} vendas${ant("vendas")}`,
    t.faturamento != null && `faturamento R$ ${fmt(t.faturamento)}`,
    t.roas != null && `ROAS ${fmt(t.roas)}${ant("roas")}`,
    t.ctr != null && `CTR ${fmt(t.ctr)}%`,
    t.cpm != null && `CPM R$ ${fmt(t.cpm)}`,
  ].filter(Boolean);
  if (trafego.length || t.observacao)
    partes.push(
      `TRÁFEGO PAGO${dados.meta_ads ? " (Meta Ads; vendas e faturamento são os atribuídos pelo pixel, a não ser que a equipe tenha corrigido)" : ""}: ${trafego.join(", ")}${t.observacao ? `. Observação: ${t.observacao}` : ""}`,
    );
  const entregas = [...dados.aprovadas.map((a) => `Peça aprovada: ${a.titulo}`), ...input.entregas];
  if (entregas.length) partes.push(`ENTREGAS DA SEMANA:\n${entregas.map((e) => `- ${e}`).join("\n")}`);
  const tr = dados.trabalho;
  if (tr && tr.feitas.length + tr.andamento.length + tr.proximas.length > 0) {
    const item = (x: { nome: string; lista: string; prazo: string | null }) => `- ${x.nome} [lista: ${x.lista.trim()}${x.prazo ? `, prazo ${x.prazo}` : ""}]`;
    partes.push(
      [
        "TRABALHO DA MANTORA (tarefas do ClickUp, internas: use só para escrever feito/andamento/proximos)",
        tr.producao.length ? `PRODUZIDO NO PERÍODO: ${tr.producao.map((p) => `${p.total} ${p.rotulo}`).join(", ")}` : "",
        tr.feitas.length ? `FEITO NO PERÍODO:\n${tr.feitas.slice(0, 40).map(item).join("\n")}` : "",
        tr.andamento.length ? `EM ANDAMENTO AGORA:\n${tr.andamento.slice(0, 30).map(item).join("\n")}` : "",
        tr.proximas.length ? `PRÓXIMO (até o fim ${input.tipo === "mes" ? "do próximo mês" : "da próxima semana"}):\n${tr.proximas.slice(0, 30).map(item).join("\n")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (input.notas?.trim()) partes.push(`NOTAS DA EQUIPE (contexto interno):\n${input.notas.trim()}`);
  return partes.join("\n\n");
}

export async function escreverTextos(input: Parameters<typeof contexto>[0]) {
  const response = await anthropic.beta.messages.parse({
    model: CAROUSEL_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: betaZodOutputFormat(textosSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: `${contexto(input)}\n\nEscreva os textos do relatório ${input.tipo === "mes" ? "deste mês" : "desta semana"}.` }],
  });
  if (response.stop_reason === "refusal") throw new GenerationError("A IA não conseguiu escrever este relatório.");
  const out = response.parsed_output;
  if (!out) throw new GenerationError("A IA não devolveu os textos. Tente novamente.");
  const textos: TextosSemana = {
    titulo: out.titulo.trim(),
    resumo: out.resumo.trim(),
    destaques: out.destaques.slice(0, 3).map((d) => ({ titulo: d.titulo.trim(), texto: d.texto.trim() })),
    proximos: out.proximos.slice(0, 4).map((p) => p.trim()).filter(Boolean),
    funcionou: (out.funcionou ?? []).slice(0, 3).map((p) => p.trim()).filter(Boolean),
    ajustar: (out.ajustar ?? []).slice(0, 3).map((p) => p.trim()).filter(Boolean),
    feito: (out.feito ?? []).slice(0, 5).map((p) => p.trim()).filter(Boolean),
    andamento: (out.andamento ?? []).slice(0, 4).map((p) => p.trim()).filter(Boolean),
    palavras: (out.palavras ?? []).slice(0, 5).map((p) => p.trim()).filter(Boolean),
  };
  const usage = response.usage;
  const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const outputTokens = usage.output_tokens ?? 0;
  const [pin, pout] = PRICES[response.model] ?? PRICES[CAROUSEL_MODEL] ?? [4, 20];
  return { textos, costUsd: (inputTokens * pin + outputTokens * pout) / 1e6, inputTokens, outputTokens, model: response.model };
}
