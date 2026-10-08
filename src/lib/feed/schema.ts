// Contratos das rotas do Post de Feed (validados no servidor).

import { z } from "zod";
import { FEED_CANVAS_SIZES } from "../formats";
import { FEED_DECORS, FEED_LAYOUTS } from "../templates/feed";
import { TITLE_FONT_IDS, type TitleFontId } from "../templates/fonts";

const imageDataUrl = z.string().max(3_000_000).nullish();
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const MAX_FEED_SLIDES = 20;

export const feedPaletteSchema = z.object({ background: hexColor, text: hexColor, accent: hexColor });
export const titleFontSchema = z.enum(TITLE_FONT_IDS as [TitleFontId, ...TitleFontId[]]);

export const customLayoutSchema = z.object({
  name: z.string().max(80),
  html: z.string().max(20_000),
  css: z.string().max(20_000),
});

export const feedRenderRequestSchema = z.object({
  brand: z.object({
    name: z.string().max(80),
    handle: z.string().max(40),
    logo: imageDataUrl,
  }),
  style: z.object({
    size: z.enum(FEED_CANVAS_SIZES),
    palette: feedPaletteSchema,
    titleFont: titleFontSchema,
    showPageNumber: z.boolean(),
    align: z.enum(["left", "center"]),
    verticalAlign: z.enum(["top", "center", "bottom"]),
    titleScale: z.number().min(0.7).max(1.4),
    decor: z.enum(FEED_DECORS),
    coverBackground: z.enum(["accent", "background"]),
    customLayout: customLayoutSchema.nullable(),
  }),
  slides: z
    .array(
      z.object({
        layout: z.enum(FEED_LAYOUTS),
        title: z.string().max(500),
        body: z.string().max(1500),
        image: imageDataUrl,
        icon: z.string().max(40).nullish(),
      }),
    )
    .min(1)
    .max(MAX_FEED_SLIDES),
});

export type FeedRenderRequest = z.infer<typeof feedRenderRequestSchema>;
