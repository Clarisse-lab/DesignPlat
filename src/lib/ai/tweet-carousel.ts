import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic, CLAUDE_MODEL } from "./claude";
import { generatedCarouselSchema, type GeneratedCarousel, type GenerateRequest } from "../tweet/schema";

const SYSTEM_PROMPT = `Você é um redator especializado em carrosséis de Instagram no formato "tweet": cada slide simula um post do X/Twitter, com texto direto, opinativo e altamente compartilhável. Escreva em português do Brasil.

Estrutura narrativa:
- Primeiro slide (capa): um hook que para o scroll. Frase curta e impactante, no máximo 12 palavras.
- Slides seguintes: fato, dado ou situação concreta que cria tensão; depois o mecanismo (por que isso acontece); depois provas, um ponto por slide, cada um aprofundando um aspecto diferente; depois a virada (o que isso significa para quem lê).
- Último slide (cta): chamada para ação clara, mencionando o @ do perfil.

Regras do texto de cada slide:
- No máximo 220 caracteres. Uma ideia por slide, completa e natural de ler em voz alta.
- Duas frases curtas são melhores que uma frase longa cheia de vírgulas.
- Quebras de linha separam ideias dentro do slide. Listas podem usar "→" no início da linha.
- Marque de 1 a 3 palavras-chave por slide em negrito com **asteriscos**.
- Toda afirmação factual precisa de especificidade (número, contexto, fonte quando houver). Não invente dados: se não tiver um dado confiável, use um exemplo concreto em vez de um número.
- Nada de emojis no texto do card.

Evite:
- Estruturas do tipo "não é X, é Y".
- Cacoetes como "e isso muda tudo", "no fim das contas", "a pergunta que fica".
- Jargões como "ecossistema", "mindset", "sinergia", "potencializar", "entregar valor".
- Aberturas genéricas como "hoje vamos falar sobre" ou "neste carrossel você vai".
- Travessões (—).

A legenda do Instagram deve ter um gancho nos primeiros 125 caracteres, 2 ou 3 parágrafos curtos, um CTA no final e de 5 a 10 hashtags relevantes.`;

export class GenerationError extends Error {}

export async function generateTweetCarousel(input: GenerateRequest): Promise<GeneratedCarousel> {
  const handle = input.handle.trim().replace(/^@+/, "") || "perfil";
  const brand = input.brandContext?.trim();

  const userPrompt = [
    `Tema: ${input.topic}`,
    `Perfil: ${input.name.trim() || handle} (@${handle})`,
    `Número de slides: exatamente ${input.slideCount}`,
    brand ? `\nContexto da marca e tom de voz:\n${brand}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await anthropic.beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(generatedCarouselSchema) },
    // Se o modelo recusar, a API refaz a requisição num modelo de fallback recomendado.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new GenerationError("A IA recusou este tema. Tente reformular o assunto.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new GenerationError("A resposta da IA ficou incompleta. Tente com menos slides.");
  }
  const result = response.parsed_output;
  if (!result || result.slides.length === 0) {
    throw new GenerationError("A IA não devolveu slides válidos. Tente novamente.");
  }
  return result;
}
