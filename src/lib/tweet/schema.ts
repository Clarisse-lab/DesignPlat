// Contratos das rotas da ferramenta Carrossel Tweet (validados no servidor).

import { z } from "zod";
import { TWEET_CANVAS_SIZES } from "../formats";

// Data URLs de imagem já vêm redimensionadas do navegador; o limite evita payloads abusivos.
const imageDataUrl = z.string().max(3_000_000).nullish();

export const MAX_SLIDES = 20;

export const tweetProfileSchema = z.object({
  name: z.string().max(80),
  handle: z.string().max(40),
  avatar: imageDataUrl,
  verified: z.boolean(),
});

export const tweetStyleSchema = z.object({
  theme: z.enum(["light", "dark"]),
  size: z.enum(TWEET_CANVAS_SIZES),
});

export const tweetSlideSchema = z.object({
  text: z.string().max(1000),
  image: imageDataUrl,
});

export const renderRequestSchema = z.object({
  profile: tweetProfileSchema,
  style: tweetStyleSchema,
  slides: z.array(tweetSlideSchema).min(1).max(MAX_SLIDES),
});

export const generateRequestSchema = z.object({
  topic: z.string().trim().min(3).max(500),
  slideCount: z.number().int().min(3).max(15),
  name: z.string().max(80),
  handle: z.string().max(40),
  brandContext: z.string().max(4000).optional(),
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

/** O que a IA devolve para montar o carrossel. */
export const generatedCarouselSchema = z.object({
  slides: z.array(
    z.object({
      role: z.enum(["capa", "conteudo", "cta"]),
      label: z.string().describe("Rótulo curto do slide para o editor, ex.: Hook, Dado, CTA"),
      text: z.string().describe("Texto do post que aparece no card"),
    }),
  ),
  caption: z.string().describe("Legenda completa do Instagram"),
});

export type GeneratedCarousel = z.infer<typeof generatedCarouselSchema>;
