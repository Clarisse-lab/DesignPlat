// Contratos das rotas do Post de Feed (validados no servidor).

import { z } from "zod";
import { POST_CANVAS_SIZES } from "../formats";
import { FEED_DECORS, FEED_LAYOUTS } from "../templates/feed";
import { FREE_ANIMS, FREE_BACKGROUNDS, FREE_CHAT_STYLES, FREE_COLORS, FREE_ELEMENT_KINDS, FREE_GRIDS, FREE_HIGHLIGHTS, FREE_OVERLAYS, FREE_PROFILE_VARIANTS } from "../templates/free";
import { ICON_IDS, type IconId } from "../templates/icons";
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

const pct = z.number().min(-20).max(140);

/** Layout Livre: elementos posicionados em % do canvas. */
export const freeSlideSchema = z.object({
  bg: z.enum(FREE_BACKGROUNDS),
  overlay: z.enum(FREE_OVERLAYS),
  progress: z.boolean().optional(),
  pan: z.object({ total: z.number().int().min(2).max(10), part: z.number().int().min(0).max(9) }).nullish(),
  preset: z.string().max(40).nullish(),
  motion: z.object({ photo: z.boolean().optional(), duration: z.number().min(3).max(15).optional() }).nullish(),
  elements: z
    .array(
      z.object({
        id: z.string().max(60),
        kind: z.enum(FREE_ELEMENT_KINDS),
        x: pct,
        y: pct,
        w: pct,
        h: pct.optional(),
        text: z.string().max(1500).optional(),
        size: z.number().min(8).max(400).optional(),
        align: z.enum(["left", "center", "right"]).optional(),
        color: z.enum(FREE_COLORS).optional(),
        highlight: z.enum(FREE_HIGHLIGHTS).optional(),
        upper: z.boolean().optional(),
        font: z.enum(["titulo", "corpo"]).optional(),
        image: imageDataUrl,
        fill: z.enum(["texto", "fundo", "destaque", "branco", "preto", "vidro"]).optional(),
        radius: z.number().min(0).max(400).optional(),
        grid: z.enum(FREE_GRIDS).optional(),
        images: z.array(imageDataUrl).max(4).optional(),
        gap: z.number().min(0).max(80).optional(),
        family: z.enum(["corpo", ...TITLE_FONT_IDS] as [TitleFontId | "corpo", ...(TitleFontId | "corpo")[]]).optional(),
        italic: z.boolean().optional(),
        shadow: z.boolean().optional(),
        variant: z.enum(FREE_PROFILE_VARIANTS).optional(),
        verified: z.boolean().optional(),
        icon: z.enum(ICON_IDS as [IconId, ...IconId[]]).optional(),
        cutout: z.boolean().optional(),
        dim: z.number().min(0).max(90).optional(),
        chat: z.enum(FREE_CHAT_STYLES).optional(),
        contact: z.string().max(60).optional(),
        time: z.string().max(5).optional(),
        anim: z.enum(FREE_ANIMS).optional(),
        delay: z.number().min(0).max(12).optional(),
      }),
    )
    .max(40),
});

export const feedRenderRequestSchema = z.object({
  brand: z.object({
    name: z.string().max(80),
    handle: z.string().max(40),
    logo: imageDataUrl,
  }),
  style: z.object({
    size: z.enum(POST_CANVAS_SIZES),
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
        notes: z.string().max(3000).nullish(),
        free: freeSlideSchema.nullish(),
      }),
    )
    .min(1)
    .max(MAX_FEED_SLIDES),
});

export type FeedRenderRequest = z.infer<typeof feedRenderRequestSchema>;

/**
 * Contrato da API de integração (/api/v1/pecas): o mesmo do editor, mas com o estilo parcial
 * (o que faltar usa o padrão). Assim o Escritório envia só o que o kit
 * de marca do cliente define.
 */
export const pecaRequestSchema = feedRenderRequestSchema.extend({
  /** Identificador de quem pediu (ex.: id da pauta no Escritório), só para os logs. */
  ref: z.string().max(100).optional(),
  style: feedRenderRequestSchema.shape.style.partial(),
});

export type PecaRequest = z.infer<typeof pecaRequestSchema>;
