import "server-only";
// Revisão de português da peça (telas e legenda): só erros (ortografia, acento, concordância,
// pontuação que muda o sentido, palavra repetida). Estilo e gíria do cliente ficam como estão.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CAROUSEL_MODEL, PRICES } from "./carousel-from-copy";
import { anthropic, GenerationError } from "./claude";

const resultSchema = z.object({
  erros: z.array(
    z.object({
      tela: z.number().int().describe("Número da tela (1, 2...); 0 para a legenda"),
      trecho: z.string().describe("O trecho com erro, copiado exatamente como está"),
      sugestao: z.string().describe("O trecho corrigido"),
      motivo: z.string().describe("Por que está errado, em poucas palavras"),
    }),
  ),
});

const SYSTEM = `Você é revisor de textos de posts de Instagram em português do Brasil. Aponte SÓ erros: ortografia, acentuação, crase, concordância, regência, pontuação que muda o sentido, palavra faltando ou repetida por engano.
NÃO aponte: gíria, linguagem informal, frases curtas, caixa alta, emojis, estilo, escolhas de palavras, "pra"/"tá"/"né", marcações ** (são destaques) e {usuario}/{nome} (são variáveis). Na dúvida, não aponte.
Se não houver erro, devolva a lista vazia.`;

export async function proofread(input: { telas: string[][]; legenda: string }) {
  const text = [
    ...input.telas.map((textos, i) => `TELA ${i + 1}:\n${textos.join("\n")}`),
    input.legenda.trim() ? `LEGENDA (tela 0):\n${input.legenda}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const response = await anthropic.beta.messages.parse({
    model: CAROUSEL_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: betaZodOutputFormat(resultSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: text }],
  });
  if (response.stop_reason === "refusal") throw new GenerationError("A IA não conseguiu revisar este texto.");
  const erros = response.parsed_output?.erros ?? [];
  const usage = response.usage;
  const inputTokens = (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  const outputTokens = usage.output_tokens ?? 0;
  const [pin, pout] = PRICES[response.model] ?? PRICES[CAROUSEL_MODEL] ?? [4, 20];
  return { erros, costUsd: (inputTokens * pin + outputTokens * pout) / 1e6, inputTokens, outputTokens, model: response.model };
}
