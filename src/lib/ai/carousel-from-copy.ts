import "server-only";
// Assistente do estúdio: transforma a copy aprovada de uma pauta do Motor de Conteúdo (ou um tema solto)
// nas telas do carrossel, com a legenda. Saída estruturada (Zod); o editor monta os slides com os modelos.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { FREE_PRESETS } from "../templates/free";
import { anthropic, GenerationError } from "./claude";

export const CAROUSEL_MODEL = process.env.CLAUDE_MODEL_CARROSSEL || "claude-sonnet-5-5";
/** US$ por milhão de tokens [entrada, saída], os mesmos do Escritório. */
const PRICES: Record<string, [number, number]> = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10] };

/** Quando usar cada modelo do Livre (o assistente escolhe por aqui). */
const MODEL_GUIDE: Record<string, string> = {
  "capa-revista": "capa com foto, etiqueta curta e título forte em caixa alta (padrão versátil)",
  "capa-marca-texto": "capa com foto e 2 ou 3 palavras do título em marca-texto; bom para tema polêmico ou notícia",
  "capa-editorial": "capa elegante com título serifado em itálico; bom para bem-estar, lifestyle, temas delicados",
  "capa-chip-central": "capa com título centralizado e etiqueta embaixo; bom para guias e listas de dicas",
  "capa-impacto": "capa com título enorme condensado; bom para frase curta e chamada forte (até 5 palavras)",
  "capa-perfil-chip": "capa com o @ do cliente acima de um título gigante e subtítulo; bom para novidade ou lançamento",
  "capa-tiras": "capa com 2 fotos lado a lado; bom para antes e depois ou comparação",
  "capa-3-tiras": "capa com 3 fotos; bom para '3 formas de', '3 erros'",
  "capa-tweet": "capa estilo tweet com selo de verificado; bom para opinião em primeira pessoa",
  "capa-manchete": "capa estilo manchete de jornal com foto; bom para notícia, dado novo, revelação",
  "capa-numero": "capa com um número gigante; só quando o título começa com número (ex.: 7 erros)",
  "capa-pergunta": "capa com interrogação gigante; quando o gancho é uma pergunta",
  "interno-texto": "tela com título e parágrafo curto (padrão)",
  "interno-cartao": "tela com cartão branco, etiqueta, título e texto; bom para destacar um ponto",
  "interno-cartao-foto": "cartão com título, texto curto e uma foto; bom para exemplo ou cenário",
  "interno-tweet": "tela estilo tweet com foto; bom para depoimento ou opinião",
  "interno-dado": "número enorme + explicação; só quando a tela gira em torno de um dado real da copy",
  "interno-checklist": "título + 2 a 4 itens com check; para listas e critérios (itens um por linha no texto)",
  "interno-passo": "passo numerado automaticamente; para passo a passo (uma etapa por tela)",
  "interno-mito-verdade": "mito no título e verdade no texto; quando a copy desmonta uma crença",
  "interno-antes-depois": "2 fotos antes/depois + título e texto",
  "interno-citacao-foto": "foto do cliente + frase dele em destaque; para citação",
  "foto-com-texto": "foto em cima, título e texto embaixo; bom para cena ou bastidor",
  "final-salvar": "fechamento pedindo para salvar e compartilhar",
  "final-seguir": "fechamento pedindo para seguir o perfil, com foto",
  "final-comente": "fechamento pedindo um comentário com palavra-chave (ex.: comente QUERO)",
  "capa-conversa": "capa com print de conversa (mensagens no texto, uma por linha; 'Eu:' para a resposta); só para depoimento ou mensagem real que a copy traz",
  "capa-notificacoes": "capa com notificações na tela bloqueada (uma por linha no texto) e título embaixo; bom para prova social ou urgência",
  "colagem-capa": "capa de colagem em papel amassado: título forte com caneta marca-texto, linha de apoio (etiqueta) e um recorte retrô P&B (objeto-metáfora ou figura anônima)",
  "colagem-item": "tela de colagem: título em máquina de escrever com caneta marca-texto (numerado em listas), texto curto e um recorte retrô P&B que é a metáfora da tela",
  "colagem-final": "fechamento de colagem em papel no tom do destaque: frase forte e chamada para comentar",
  "interno-conversa": "tela com print de conversa (mensagens no texto, uma por linha; 'Eu:' para a resposta); só para depoimento ou diálogo real da copy",
};
const MODEL_IDS = FREE_PRESETS.map((p) => p.id) as [string, ...string[]];
const PHOTO_MODELS = new Set(FREE_PRESETS.filter((p) => p.photo).map((p) => p.id));
const IMAGE_SLOT_MODELS = new Set(["colagem-capa", "colagem-item", "capa-tiras", "capa-3-tiras", "capa-tweet", "capa-manchete", "interno-cartao-foto", "interno-tweet", "interno-antes-depois", "interno-citacao-foto", "foto-com-texto"]);
export const modelUsesImage = (id: string) => PHOTO_MODELS.has(id) || IMAGE_SLOT_MODELS.has(id);

export const studioCarouselSchema = z.object({
  slides: z
    .array(
      z.object({
        tipo: z.enum(["capa", "texto", "lista", "numero", "citacao", "cta"]),
        modelo: z.enum(MODEL_IDS).describe("Modelo visual da tela, escolhido no catálogo"),
        etiqueta: z.string().describe("Etiqueta curta acima do título (até 4 palavras), ou vazio"),
        titulo: z.string().describe("Título da tela. Na lista, o título; no número, o número seguido do que ele mede"),
        texto: z.string().describe("Texto de apoio. Na lista, um item por linha; na citação, o autor"),
        imagem: z.string().describe("Se o modelo usa foto: descrição da cena para gerar com IA, em português, sem nenhum texto na imagem. Vazio se não usa foto"),
        rosto: z.boolean().describe("true se a foto deve mostrar o próprio cliente"),
      }),
    )
    .describe("As telas do carrossel, de 3 a 12"),
  legenda: z.string().describe("Legenda do post para o Instagram"),
});
export type StudioCarousel = z.infer<typeof studioCarouselSchema>;

const SYSTEM = `Você monta carrosséis de Instagram para a agência Mantora, a partir da copy aprovada pela equipe (ou de um tema). Escreva em português do Brasil, na voz do cliente.

Se a copy já vem dividida em telas (TELA 01, TELA 02... ou numeração parecida), siga exatamente essa divisão e esse texto; só encurte o que não couber. Se não vier dividida, divida você: uma ideia por tela.

Tipos de tela:
- capa: a primeira, sempre. Título é o gancho (no máximo 12 palavras). Etiqueta opcional com o tema (até 4 palavras).
- texto: título curto + texto de apoio (até 300 caracteres).
- lista: título + itens, um por linha, até 6 itens curtos.
- numero: quando a tela gira em torno de um dado real da copy. Título é só o número; texto explica.
- citacao: frase forte do cliente; texto é o autor (o nome do cliente) ou vazio.
- cta: a última, sempre. Chamada clara para a ação da copy.

Regras:
- Marque de 1 a 3 palavras-chave por título com **asteriscos** (o design destaca essas palavras).
- Não invente dados, números, depoimentos nem promessas que não estão na copy.
- Nada de emojis nem travessões (—) no texto das telas.
- A legenda: gancho nos primeiros 125 caracteres, 2 ou 3 parágrafos curtos, CTA no fim e de 3 a 8 hashtags. Se a copy trouxer a legenda pronta, use a dela.`;

function catalog(): string {
  return FREE_PRESETS.map((p) => `- ${p.id} (${p.category}): ${MODEL_GUIDE[p.id] ?? p.label}`).join("\n");
}

const DESIGN_RULES = `
DESIGN: para cada tela, escolha um modelo do catálogo abaixo pelo conteúdo, não ao acaso.
- A primeira tela usa um modelo de capa; a última, um de fechamento; as do meio, telas internas.
- Varie: não repita o mesmo modelo interno em duas telas seguidas, a menos que seja uma sequência de passos (interno-passo).
- Use interno-dado, capa-numero e interno-checklist só quando o conteúdo combinar (número real, lista de itens).
- Para modelos com foto, escreva em "imagem" uma cena concreta e fotografável que ilustre a tela (pessoas, lugar, luz, objetos), sem texto, logotipo nem pessoas famosas. Marque "rosto" quando fizer sentido o próprio cliente aparecer (capa, bastidor, citação). Para modelos sem foto, deixe "imagem" vazio.

CATÁLOGO:
`;

/** Regras do estilo de referência: vêm depois do catálogo e mandam nele. */
function estiloRules(estilo: { nome: string; modelos: string[]; texto: string; cenaImagem: string }): string {
  const validos = estilo.modelos.filter((m) => MODEL_IDS.includes(m));
  return [
    `\n\nESTILO DE REFERÊNCIA: "${estilo.nome}". Ele manda sobre as regras de design acima.`,
    validos.length ? `- Use SOMENTE estes modelos: ${validos.join(", ")}. Capa, telas internas e fechamento saem só dessa lista.` : "",
    estilo.texto ? `- Texto: ${estilo.texto}` : "",
    estilo.cenaImagem ? `- Imagens: ${estilo.cenaImagem}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateStudioCarousel(input: {
  nome: string;
  handle: string;
  slideCount: number | null;
  pauta?: { titulo: string; formato: string | null; angulo: string | null; copy: string } | null;
  tema?: string | null;
  /** Modelos escolhidos no painel (ex.: "capa: capa-manchete; internas: interno-cartao"). */
  prefer?: string | null;
  /** Estilo de referência: restringe os modelos e orienta texto e imagens. */
  estilo?: { nome: string; modelos: string[]; texto: string; cenaImagem: string } | null;
}): Promise<{ carousel: StudioCarousel; costUsd: number; inputTokens: number; outputTokens: number; model: string }> {
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
    input.slideCount ? `Número de telas: exatamente ${input.slideCount}` : "Número de telas: o que a copy pedir (entre 5 e 10 se ela não disser).",
    "",
    source,
  ].join("\n");

  const response = await anthropic.beta.messages.parse({
    model: CAROUSEL_MODEL,
    max_tokens: 8000,
    output_config: { effort: "medium", format: betaZodOutputFormat(studioCarouselSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system:
      SYSTEM +
      DESIGN_RULES +
      catalog() +
      (input.estilo ? estiloRules(input.estilo) : input.prefer ? `\n\nPREFERÊNCIA DA EQUIPE: ${input.prefer}` : ""),
    messages: [{ role: "user", content: prompt }],
  });
  if (response.stop_reason === "refusal") throw new GenerationError("A IA recusou este conteúdo. Tente reformular.");
  if (response.stop_reason === "max_tokens") throw new GenerationError("A resposta ficou incompleta. Tente com menos telas.");
  const carousel = response.parsed_output;
  if (!carousel || carousel.slides.length < 2) throw new GenerationError("A IA não devolveu telas válidas. Tente de novo.");

  carousel.slides = carousel.slides.slice(0, 12);
  const usage = response.usage;
  const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const outputTokens = usage.output_tokens ?? 0;
  const [pin, pout] = PRICES[response.model] ?? PRICES[CAROUSEL_MODEL] ?? [4, 20];
  return { carousel, costUsd: (inputTokens * pin + outputTokens * pout) / 1e6, inputTokens, outputTokens, model: response.model };
}
