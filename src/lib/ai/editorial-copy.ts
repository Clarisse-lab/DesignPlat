import "server-only";
// Copy do layout Editorial: a IA escreve o carrossel já sabendo o tipo de cada tela (roteiro, molde de
// capa e formato de texto de cada tela). Referência: carrosséis da @brandsdecoded__ e o guia
// "50 ideias de carrossel" deles (resumo em claude/estilo-editorial-carrossel.md, no projeto do Claude).

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { EDITORIAL_TELAS, type EditorialTela } from "../templates/editorial";
import { expandEditorial, type EditorialGeneratedSlide } from "../feed/editorial-map";
import { anthropic, GenerationError } from "./claude";
import { CAROUSEL_MODEL, PRICES } from "./carousel-from-copy";

export const ROTEIROS = ["noticia", "caso", "ensaio", "novidades", "metodo"] as const;
export type Roteiro = (typeof ROTEIROS)[number];

/** O que a equipe pediu de fotos: sem isso a IA tende a escolher telas só de texto. */
const FOTOS: Record<"nenhuma" | "capa" | "todas", string> = {
  nenhuma: "FOTOS: nenhuma. Use capa-impacto na capa e deixe \"imagem\" vazio em todas as telas.",
  capa: "FOTOS: só na capa, com a cena descrita em \"imagem\". Nas outras telas, \"imagem\" vazio.",
  todas:
    "FOTOS: a equipe vai gerar fotos, e o estilo depende delas (como nos carrosséis de referência, a maioria das telas tem imagem). A capa leva foto. Toda tela frase-imagem, foto-texto, imagem-lista, frase e cta-comente leva a cena em \"imagem\" (no CTA, o material oferecido sobre uma mesa). Só passo, checklist, revela, lacunas, equacao e respiro ficam sem foto; use no máximo 3 dessas no carrossel.",
};

export const editorialCarouselSchema = z.object({
  roteiro: z.enum(ROTEIROS).describe("Roteiro escolhido para o conteúdo"),
  molde: z.number().int().describe("Número do molde de capa usado (1 a 50), ou 0 se nenhum encaixou"),
  slides: z
    .array(
      z.object({
        tela: z.enum(EDITORIAL_TELAS).describe("Tipo de tela, escolhido pelo conteúdo"),
        etiqueta: z.string().describe("Só em 'passo' (ex.: Passo a passo) e 'frase' (ex.: Frase 1). Nas outras, vazio"),
        titulo: z.string().describe("Texto principal da tela, no formato do tipo"),
        texto: z.string().describe("Texto de apoio ou itens (um por linha), no formato do tipo"),
        palavra: z.string().describe("Só no 'cta-comente': a palavra que a pessoa comenta, uma palavra em caixa alta. Nas outras, vazio"),
        fonte: z.string().describe("Quem publicou ou apurou a informação desta tela, se a copy disser (ex.: Receita Federal, Folha). Senão, vazio"),
        sinal: z.enum(["", "sim", "nao"]).describe("Só em 'revela': 'nao' para o que evitar, 'sim' para o que fazer. Nas outras, vazio"),
        imagem: z.string().describe("Se a tela usa foto: a cena para gerar com IA, em português, concreta e fotografável, sem texto na imagem. Senão, vazio"),
        rosto: z.boolean().describe("true se a foto deve mostrar o próprio cliente"),
      }),
    )
    .describe("As telas do carrossel, na ordem"),
  legenda: z.string().describe("Legenda do post para o Instagram"),
});
export type EditorialCarousel = z.infer<typeof editorialCarouselSchema>;

/** Moldes de capa (resumo nosso dos 50 do guia), numerados como no guia. */
const MOLDES = [
  "hábito do país medido por pesquisa", "regra social que todos seguem sem notar", "instituição agindo fora do esperado",
  "cansaço ou incômodo coletivo, com dado e explicação", "geração com fama ruim e de onde vem a fama", "comparação absurda que explica um problema econômico",
  "grupo trocando um hábito antigo por um novo", "atividade comum que virou símbolo de status", "volta de um objeto antigo para fugir de um problema atual",
  "tendência com o número de crescimento na capa", "espaço que mudou de público", "aposta para o ano que vem com os sinais de hoje",
  "tese curta defendida com casos de quem já faz", "negócio que vende antes de mostrar o produto", "começo pequeno até marca grande, com os números do caminho",
  "virada de uma marca contada pelas decisões", "evento que virou a referência do setor", "collab improvável e o objetivo comercial",
  "\"primeira vez na história\" e por que aquela escolha", "campanha nascida de um detalhe", "evento pequeno que cresceu além do planejado",
  "quanto as marcas pagam por um espaço disputado", "bastidor de empresa contado como história", "primeira pessoa do país a conquistar algo",
  "profissional que cresceu indo contra o que todos fazem", "erros de quem chegou ao topo, contados por ele", "método de especialista explicado para quem está começando",
  "dois fatos opostos da mesma pessoa", "pessoa virando referência graças à internet", "quem está formando uma nova geração na profissão",
  "marca pessoal maior que a instituição", "o lado da pessoa que o público não vê", "grande nome do setor decretando o fim de algo",
  "novidade da plataforma que favorece um formato", "resumo das novidades que o leitor perdeu", "lançamento explicado por completo",
  "plataforma copiando o concorrente e o motivo", "por que um tipo de empresa tem perfil chato + passo a passo", "experimento real que prova que dá para crescer do zero",
  "pergunta que cutuca um esforço talvez desnecessário", "funções novas que o leitor ainda não testou", "projeto da própria empresa mostrado como prova",
  "número enorme e a previsão que ele permite", "quanto dinheiro um assunto já movimentou", "preço surpreendente de algo que todos conhecem",
  "organização contratando profissões inesperadas", "marca entrando no evento cultural da semana", "o antigo e o novo lado a lado",
  "a história de como algo piorou, com o que fazer", "o bastidor do próprio resultado, explicado para o leitor",
];

const TELAS: Record<EditorialTela, string> = {
  "capa-foto": "capa com foto na tela toda e manchete em frase (não caixa alta). Só quando a manchete passa de 75 caracteres. título = 60 a 140 caracteres, com o fim (3 a 6 palavras) entre **asteriscos**. texto vazio. Precisa de foto",
  "capa-impacto": "capa em caixa alta condensada, com ou sem foto de fundo (a preferida da equipe). título = manchete de até 75 caracteres, com 1 a 3 palavras entre **asteriscos**. texto vazio",
  "frase-imagem": "a tela padrão. título = uma ideia em frase completa de 80 a 200 caracteres (2 a 4 linhas), com no máximo um trecho entre **asteriscos**. texto = apoio de até 160 caracteres. Foto opcional (print, cena, produto)",
  "foto-texto": "foto na tela toda com o texto embaixo; para cena forte ou virada. título até 140 caracteres; texto até 140. Precisa de foto",
  "imagem-lista": "lista com setas. título = frase que abre a lista (até 90). texto = 3 a 5 itens, um por linha, no formato \"Rótulo curto: explicação\" (até 90 caracteres cada). Foto opcional em cima",
  passo: "passo a passo. título = frase que abre (até 80). etiqueta = \"Passo a passo\" ou parecido. texto = 3 a 5 passos, um por linha, cada um começando com verbo (até 90 caracteres)",
  respiro: "pausa com frase serifada, fundo creme. título = frase de efeito de até 110 caracteres. texto = 120 a 220 caracteres; use para \"**Na nossa leitura,** …\" ou para a ressalva honesta",
  revela: "lista que abre um item por tela: VOCÊ ESCREVE UMA TELA SÓ e o sistema a desdobra em uma tela por item (conta como uma tela por item). título = título curto terminando em dois-pontos (até 30, ex.: \"Não conte com:\" ou \"Vale priorizar:\"). texto = 2 a 4 itens, um por linha, \"Item curto (até 40): explicação (até 140)\". sinal = nao (o que evitar) ou sim (o que fazer). Use duas 'revela' seguidas (uma nao e uma sim) quando o conteúdo tiver o que evitar e o que fazer",
  checklist: "checklist. título = o que revisar (até 50). texto = 3 ou 4 itens, um por linha, \"Onde: o que fazer\" (até 100 caracteres cada; ex.: \"Na legenda: descreva o assunto com as palavras do cliente.\")",
  frase: "citação numerada, para frases de um método ou depoimento. etiqueta = \"Frase 1\", \"Frase 2\"... título = a frase entre aspas, em primeira pessoa (até 170). texto = comentário curto do que a frase faz (até 160). Foto opcional",
  lacunas: "modelo para o leitor copiar. título = \"Frases para preencher\" ou parecido. texto = 3 a 5 frases, uma por linha, com as lacunas [entre colchetes] (até 90 caracteres cada)",
  equacao: "\"na nossa leitura\" em forma de conta, fundo na cor de destaque. título = frase que apresenta a ideia, começando com **Na nossa leitura,** (até 140). texto = exatamente 3 linhas: \"Parte A: explicação\", \"Parte B: explicação\" e \"= Resultado: explicação\" (nomes até 30, explicações até 70)",
  "cta-comente": "fechamento com barra de comentário. título = \"Se você quer [resultado], **[o que a marca oferece]**\" (até 150). palavra = UMA palavra em caixa alta ligada à isca (ex.: GUIA, ROTEIRO, LISTA). texto = a isca concreta embaixo da barra, começando com \"e eu te mando\" ou \"e a gente te manda\" (até 90). Foto opcional do material",
};

const ROTEIRO_GUIA = `ROTEIROS (escolha um pelo conteúdo e siga a ordem; adapte ao número de telas):
- noticia (notícia, mudança, lançamento): capa com a consequência → o fato com data e fonte → contexto → desdobramento em lista → por que importa para o leitor → passo a passo → ressalva honesta → CTA.
- caso (marca, empresa ou pessoa): contraste com número na capa → quem é e o tamanho do negócio → a virada → como funciona (lista ou equação) → a prova → o método → "na nossa leitura" → CTA.
- ensaio (tese, comportamento, opinião da marca): pergunta-gancho → observação do dia a dia → dado ou estudo → ampliação → frase serifada → o que isso muda para o leitor → CTA.
- novidades (o que mudou e o que fazer): capa com a novidade → quem disse e quando → "Não conte com:" (revela nao) → "Vale priorizar:" (revela sim) → checklist do que revisar → CTA.
- metodo (método de alguém aplicado a um negócio comum): quem ensinou e onde → o problema de um negócio comum → uma 'frase' por etapa do método → lacunas para o leitor preencher → CTA.`;

const SYSTEM = `Você escreve carrosséis de Instagram no estilo editorial (jornalístico) para a agência Mantora. A copy aprovada (ou o tema) traz o conteúdo e a voz do cliente; você transforma isso em telas prontas, cada uma no formato do seu tipo. Escreva em português do Brasil.

COMO ESCREVER:
- Primeira tela: a capa segue um MOLDE (lista abaixo). Fórmula que funciona: fato concreto (número, nome, lugar, data) + dois-pontos + pergunta "por que / como / o que está por trás". Variações: "Como X fez Y", tese curta afirmativa, "tudo que você precisa saber", "antigo x novo".
- Segunda tela: o fato, com data, número ou nome, e quem publicou (preencha "fonte").
- Uma ideia por tela, em frase completa. Apoio curto, que acrescenta, sem repetir o título.
- Tom de jornalista: claro, sem exagero, sem "você precisa", sem emoji, sem travessão (—), sem exclamação.
- Fonte declarada: diga quem apurou e o que não foi confirmado. Exemplo inventado é avisado ("Num exemplo fictício, …").
- Tenha uma tela que traduz a lição para o negócio do leitor e, se couber, uma ressalva honesta.
- No máximo um trecho entre **asteriscos** por tela (vira a cor de destaque). Na capa, o fim da manchete.
- Não varie de tipo só por variar: escolha o tipo pelo que o conteúdo é (lista, passos, citação, conta, frase).
- Não repita o mesmo tipo em duas telas seguidas, exceto 'revela' (uma de nao e uma de sim) e 'frase' (etapas de um método).
- Fechamento: 'cta-comente', com isca concreta ligada ao assunto. Se a copy trouxer outro CTA, adapte a ele.

FATOS: use só o que está na copy ou no tema. Não invente números, datas, nomes, falas nem fontes. Se faltar dado para um molde, escolha outro molde ou escreva sem o número.

Se a copy vier dividida em telas (TELA 01, TELA 02...), mantenha a ordem e o conteúdo, mas reescreva cada tela no formato do tipo escolhido (cortando o que não couber).

FOTOS: prefira foto onde ela prova algo ou mostra a cena (capa, foto-texto, frase-imagem). Em "imagem", uma cena concreta e fotografável (pessoas, lugar, luz, objetos), sem texto, logotipo nem pessoas famosas. Marque "rosto" quando o próprio cliente deve aparecer.

LEGENDA: a primeira frase repete o fato principal da capa com mais contexto; 2 ou 3 parágrafos curtos; termina com o mesmo CTA da última tela; de 3 a 6 hashtags. Se a copy trouxer a legenda pronta, use a dela.

TIPOS DE TELA (campo "tela"):
${Object.entries(TELAS).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

${ROTEIRO_GUIA}

MOLDES DE CAPA (campo "molde"):
${MOLDES.map((m, i) => `${i + 1}. ${m}`).join("\n")}`;

export async function generateEditorialCarousel(input: {
  nome: string;
  handle: string;
  slideCount: number | null;
  pauta?: { titulo: string; formato: string | null; angulo: string | null; copy: string } | null;
  tema?: string | null;
  /** Quais telas terão foto gerada: a IA escolhe os tipos com foto e escreve a cena nelas. */
  imagens?: "nenhuma" | "capa" | "todas";
}): Promise<{ carousel: { roteiro: Roteiro; molde: number; slides: EditorialGeneratedSlide[]; legenda: string }; costUsd: number; inputTokens: number; outputTokens: number; model: string }> {
  const source = input.pauta
    ? [
        `PAUTA: ${input.pauta.titulo}`,
        input.pauta.formato ? `FORMATO PREVISTO: ${input.pauta.formato}` : "",
        input.pauta.angulo ? `ÂNGULO: ${input.pauta.angulo}` : "",
        `\nCOPY APROVADA:\n${input.pauta.copy}`,
      ]
        .filter(Boolean)
        .join("\n")
    : `TEMA: ${input.tema}`;
  const prompt = [
    `Cliente: ${input.nome}${input.handle ? ` (@${input.handle.replace(/^@+/, "")})` : ""}`,
    FOTOS[input.imagens ?? "nenhuma"],
    input.slideCount ? `Número de telas: ${input.slideCount} (cada item de uma 'revela' conta como uma tela)` : "Número de telas: de 7 a 10 (cada item de uma 'revela' conta como uma tela).",
    "",
    source,
  ].join("\n");

  const response = await anthropic.beta.messages.parse({
    model: CAROUSEL_MODEL,
    max_tokens: 10000,
    output_config: { effort: "medium", format: betaZodOutputFormat(editorialCarouselSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new GenerationError("A IA recusou este conteúdo. Tente reformular.");
  if (response.stop_reason === "max_tokens") throw new GenerationError("A resposta ficou incompleta. Tente com menos telas.");
  const parsed = response.parsed_output;
  if (!parsed || parsed.slides.length < 2) throw new GenerationError("A IA não devolveu telas válidas. Tente de novo.");

  const usage = response.usage;
  const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const outputTokens = usage.output_tokens ?? 0;
  const [pin, pout] = PRICES[response.model] ?? PRICES[CAROUSEL_MODEL] ?? [4, 20];
  return {
    carousel: { roteiro: parsed.roteiro, molde: parsed.molde, slides: expandEditorial(parsed.slides), legenda: parsed.legenda },
    costUsd: (inputTokens * pin + outputTokens * pout) / 1e6,
    inputTokens,
    outputTokens,
    model: response.model,
  };
}
