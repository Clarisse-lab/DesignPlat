// Contrato da rota de renderização do Post de Feed (validado no servidor).

import { z } from "zod";
import { FEED_CANVAS_SIZES } from "../formats";
import { FEED_LAYOUTS } from "../templates/feed";

const imageDataUrl = z.string().max(3_000_000).nullish();
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const MAX_FEED_SLIDES = 20;

export const feedRenderRequestSchema = z.object({
  brand: z.object({
    name: z.string().max(80),
    handle: z.string().max(40),
    logo: imageDataUrl,
  }),
  style: z.object({
    size: z.enum(FEED_CANVAS_SIZES),
    palette: z.object({ background: hexColor, text: hexColor, accent: hexColor }),
    titleFont: z.enum(["sans", "serif"]),
    showPageNumber: z.boolean(),
  }),
  slides: z
    .array(
      z.object({
        layout: z.enum(FEED_LAYOUTS),
        title: z.string().max(500),
        body: z.string().max(1500),
        image: imageDataUrl,
      }),
    )
    .min(1)
    .max(MAX_FEED_SLIDES),
});

export type FeedRenderRequest = z.infer<typeof feedRenderRequestSchema>;
