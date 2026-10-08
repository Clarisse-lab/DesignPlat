// Tamanhos de canvas suportados pelo renderizador HTML → imagem.
// Cada ferramenta (carrossel tweet, feed, story, apresentação) escolhe um destes.

export const CANVAS_SIZES = {
  "portrait-3x4": { width: 1080, height: 1440, label: "Retrato 3:4 (1080×1440)" },
  "portrait-4x5": { width: 1080, height: 1350, label: "Retrato 4:5 (1080×1350)" },
  "square-1x1": { width: 1080, height: 1080, label: "Quadrado 1:1 (1080×1080)" },
  "story-9x16": { width: 1080, height: 1920, label: "Story 9:16 (1080×1920)" },
  "slide-16x9": { width: 1920, height: 1080, label: "Apresentação 16:9 (1920×1080)" },
} as const;

export type CanvasSizeId = keyof typeof CANVAS_SIZES;

export const TWEET_CANVAS_SIZES = ["portrait-3x4", "portrait-4x5", "square-1x1"] as const satisfies readonly CanvasSizeId[];
export type TweetCanvasSizeId = (typeof TWEET_CANVAS_SIZES)[number];

export const FEED_CANVAS_SIZES = ["portrait-4x5", "square-1x1", "portrait-3x4"] as const satisfies readonly CanvasSizeId[];
export type FeedCanvasSizeId = (typeof FEED_CANVAS_SIZES)[number];
