import "server-only";
// Assistente do estúdio: transforma a copy aprovada de uma pauta do Motor de Conteúdo (ou um tema solto)
// nas telas do carrossel, com a legenda. Saída estruturada (Zod); o editor monta os slides com os modelos.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { anthropic, GenerationError } from "./claude";

export const CAROUSEL_MODEL = process.env.CLAUDE_MODEL_CARROSSEL || "claude-sonnet-5-5";
/** US$ por milhão de tokens [entrada, saída], os mesmos do Escritório. */
const PRICES: Record<string, [number, number]> = { "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10] };

export const studioCarouselSchema = z.object({
  slides: z
    .array(
      z.object({
        tipo: z.enum(["capa", "texto", "lista", "numero", "citacao", "cta"]),
        etiqueta: z.string().describe("Etiqueta curta acima do título (até 4 palavras), ou vazio"),
        titulo: z.string().describe("Título da tela. Na lista, o título; no número, só o número (ex.: +37%)"),
        texto: z.string().describe("Texto de apoio. Na lista, um item por linha; na citação, o autor"),
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

export async function generateStudioCarousel(input: {
  nome: string;
  handle: string;
  slideCount: number | null;
  pauta?: { titulo: string; formato: string | null; angulo: string | null; copy: string } | null;
  tema?: string | null;
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
    system: SYSTEM,
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
