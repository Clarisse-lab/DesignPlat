// Configuração dos editores que usam o template de post: Post de Feed, Story e Apresentação.

import { FEED_CANVAS_SIZES, PRESENTATION_CANVAS_SIZES, STORY_CANVAS_SIZES, type PostCanvasSizeId } from "@/lib/formats";
import { DEFAULT_FEED_STYLE, FEED_LAYOUTS, PRESENTATION_ONLY_LAYOUTS, STORY_ONLY_LAYOUTS, type FeedLayout } from "@/lib/templates/feed";
import { newFeedSlide, type FeedDraft } from "./useFeedDraft";

export type PostMode = "feed" | "story" | "apresentacao";

const without = (excluded: readonly FeedLayout[][]) => FEED_LAYOUTS.filter((layout) => !excluded.flat().includes(layout));

export interface PostModeConfig {
  mode: PostMode;
  title: string;
  subtitle: string;
  storageKey: string;
  zipName: string;
  sizes: readonly PostCanvasSizeId[];
  layouts: readonly FeedLayout[];
  initialDraft: () => FeedDraft;
}

export const FEED_STORAGE_KEY = "designplat:feed-draft:v1";

export const POST_MODES: Record<PostMode, PostModeConfig> = {
  feed: {
    mode: "feed",
    title: "Post de Feed",
    subtitle: "Posts e carrosséis com a identidade da sua marca. O preview é a imagem final.",
    storageKey: FEED_STORAGE_KEY,
    zipName: "post-feed.zip",
    sizes: FEED_CANVAS_SIZES,
    layouts: without([[...STORY_ONLY_LAYOUTS], [...PRESENTATION_ONLY_LAYOUTS]]),
    initialDraft: () => ({
      brand: { name: "Sua Marca", handle: "suamarca", logo: null },
      style: DEFAULT_FEED_STYLE,
      slides: [
        newFeedSlide({ layout: "destaque", title: "3 sinais de que sua marca precisa de **consistência**", body: "Arrasta para o lado →" }),
        newFeedSlide({
          layout: "texto",
          title: "1. Cada post parece de uma empresa diferente",
          body: "Cores, fontes e tom de voz mudam toda semana. O público não **reconhece** você no feed.",
        }),
        newFeedSlide({ layout: "citacao", title: "Marca forte é a que você reconhece antes de ler o nome.", body: "Equipe Mantora" }),
      ],
    }),
  },
  story: {
    mode: "story",
    title: "Story",
    subtitle: "Sequências de stories 9:16. As faixas marcadas no preview são cobertas pelo Instagram e não saem na imagem.",
    storageKey: "designplat:story-draft:v1",
    zipName: "stories.zip",
    sizes: STORY_CANVAS_SIZES,
    layouts: without([[...PRESENTATION_ONLY_LAYOUTS]]),
    initialDraft: () => ({
      brand: { name: "Sua Marca", handle: "suamarca", logo: null },
      style: { ...DEFAULT_FEED_STYLE, size: "story-9x16", align: "center" },
      slides: [
        newFeedSlide({ layout: "destaque", title: "Bastidores de **hoje**", body: "Vem ver como a gente trabalha →", icon: "camera" }),
        newFeedSlide({ layout: "sticker", title: "Qual tema você quer ver amanhã?", body: "Responde na enquete ↓" }),
        newFeedSlide({ layout: "cta", title: "O conteúdo completo está no blog", body: "Toque no link" }),
      ],
    }),
  },
  apresentacao: {
    mode: "apresentacao",
    title: "Apresentação",
    subtitle: "Slides 16:9 com a identidade da marca. Baixe em PDF, em PowerPoint (PPTX) ou em imagens.",
    storageKey: "designplat:presentation-draft:v1",
    zipName: "apresentacao-imagens.zip",
    sizes: PRESENTATION_CANVAS_SIZES,
    layouts: without([[...STORY_ONLY_LAYOUTS]]),
    initialDraft: () => ({
      brand: { name: "Sua Marca", handle: "", logo: null },
      style: { ...DEFAULT_FEED_STYLE, size: "slide-16x9", decor: "formas" },
      slides: [
        newFeedSlide({ layout: "destaque", title: "Planejamento de **conteúdo** 2027", body: "Equipe Mantora · Outubro", icon: "foguete" }),
        newFeedSlide({ layout: "lista", title: "Agenda", body: "Onde estamos\nO que aprendemos\nNossos pilares\nPróximos passos" }),
        newFeedSlide({ layout: "secao", title: "Onde estamos", body: "Resultados dos últimos 6 meses" }),
        newFeedSlide({ layout: "numero", title: "+37%", body: "de alcance médio por post desde que padronizamos a identidade visual" }),
        newFeedSlide({
          layout: "colunas",
          title: "Nossos pilares",
          body: "Educar\nConteúdo que ensina algo útil em poucos segundos.\n\nInspirar\nHistórias reais de clientes e bastidores.\n\nVender\nOfertas claras, com uma chamada por vez.",
        }),
        newFeedSlide({ layout: "destaque", title: "Obrigado!", body: "Perguntas?" }),
      ],
    }),
  },
};
