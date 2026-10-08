import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CANVAS_SIZES, type FeedCanvasSizeId } from "../formats";
import { FEED_DECORS, type CustomLayout, type FeedPalette, type FeedStyle } from "../templates/feed";
import { TITLE_FONT_IDS, TITLE_FONTS, type TitleFontId } from "../templates/fonts";
import { ICON_IDS } from "../templates/icons";
import { sanitizeLayoutCss, sanitizeLayoutHtml } from "../templates/sanitize";
import { safeColor } from "../templates/utils";
import { anthropic, CLAUDE_MODEL, GenerationError } from "./claude";

const referenceStyleSchema = z.object({
  name: z.string().describe("Nome curto do estilo, em português, ex.: 'Editorial com faixa lateral'"),
  palette: z.object({
    background: z.string().describe("Cor de fundo predominante, #RRGGBB"),
    text: z.string().describe("Cor principal dos textos, #RRGGBB"),
    accent: z.string().describe("Cor de destaque, #RRGGBB"),
  }),
  titleFont: z.enum(TITLE_FONT_IDS as [TitleFontId, ...TitleFontId[]]),
  align: z.enum(["left", "center"]),
  verticalAlign: z.enum(["top", "center", "bottom"]),
  decor: z.enum(FEED_DECORS),
  suggestedIcon: z.enum(["nenhum", ...ICON_IDS] as [string, ...string[]]),
  html: z.string().describe("Marcação do layout (só o conteúdo de dentro do canvas), com os placeholders"),
  css: z.string().describe("CSS do layout"),
});

export interface ReferenceStyleResult {
  name: string;
  style: Pick<FeedStyle, "palette" | "titleFont" | "align" | "verticalAlign" | "decor">;
  customLayout: CustomLayout;
  icon: string | null;
}

function systemPrompt(width: number, height: number): string {
  const fonts = TITLE_FONT_IDS.map((id) => `- "${id}": ${TITLE_FONTS[id].label} (${TITLE_FONTS[id].stack})`).join("\n");
  return `Você é um designer de social media que recria layouts em HTML/CSS. Você recebe a imagem de um post de Instagram usado como referência e deve criar um template que reproduza a composição dele: posição e hierarquia dos textos, blocos de cor, formas, faixas, molduras, cantos arredondados, sombras, contornos e espaçamentos. O conteúdo (textos, fotos) virá de outro post, então o template precisa funcionar com textos de tamanhos diferentes.

O canvas tem exatamente ${width}×${height} px. Seu HTML é inserido dentro de <div class="ref-root"> com esse tamanho, position:relative e overflow:hidden. O fundo da página já é var(--bg).

Placeholders que você deve usar no HTML (eles são substituídos pelo conteúdo real):
- {{title}}: título do slide (texto, pode ter <strong>)
- {{body}}: texto de apoio (pode vir vazio)
- {{image}}: uma <img> já pronta com a foto do slide (pode vir vazio). Coloque dentro de um contêiner com tamanho definido; a imagem ocupa 100% dele com object-fit:cover.
- {{image_url}}: só o endereço da foto, para usar em CSS: background-image:url({{image_url}})
- {{icon}}: um ícone em SVG (pode vir vazio); o tamanho segue o font-size do contêiner
- {{logo}}: a logo redonda da marca (56px); {{handle}}: o @ da marca; {{brand}}: o nome da marca; {{page}}: a numeração, ex.: 2/5 (pode vir vazio)

Variáveis CSS disponíveis (use-as em vez de valores fixos):
- Cores: var(--bg), var(--text), var(--accent), var(--on-accent) (texto legível sobre o destaque)
- Título: font-family:var(--title-font); font-weight:var(--title-weight); text-transform:var(--title-transform); font-size:var(--title-size) (já ajustado ao tamanho do texto)
- Texto de apoio: font-size:var(--body-size). A fonte do corpo é Inter.

Fontes disponíveis para o título (escolha em titleFont a mais parecida com a da referência):
${fonts}

Regras:
- Reproduza a referência com fidelidade; não aplique um estilo próprio nem "melhore" o design.
- Use só HTML e CSS. Sem <script>, sem <style> no HTML (o CSS vai no campo css), sem links, sem imagens externas e sem url() que não seja {{image_url}}. Formas podem ser divs com CSS ou <svg> inline.
- Prefixe todas as classes com "r-" e não estilize html, body nem seletores globais.
- Use position:absolute para os blocos quando a referência pedir; garanta que textos longos quebrem linha sem sair do canvas (max-width, overflow-wrap).
- Use {{logo}} e {{handle}} onde a referência mostra a marca; se a referência não mostrar marca, coloque-os discretos num canto.
- palette deve refletir as cores da referência, em #RRGGBB. Em decor, escolha "nenhum" (o próprio layout já contém as formas), exceto se for muito óbvio que um dos efeitos simples combina.
- suggestedIcon: um ícone que combine com a referência, ou "nenhum".`;
}

export async function styleFromReference(input: {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  size: FeedCanvasSizeId;
}): Promise<ReferenceStyleResult> {
  const { width, height } = CANVAS_SIZES[input.size];

  const response = await anthropic.beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(referenceStyleSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: systemPrompt(width, height),
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.imageBase64 } },
          { type: "text", text: "Recrie o layout desta referência como template, seguindo as regras." },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new GenerationError("A IA não conseguiu analisar esta imagem. Tente outra referência.");
  if (response.stop_reason === "max_tokens") throw new GenerationError("A resposta da IA ficou incompleta. Tente novamente.");
  const result = response.parsed_output;
  if (!result || !result.html.trim()) throw new GenerationError("A IA não devolveu um layout válido. Tente novamente.");

  const palette: FeedPalette = {
    background: safeColor(result.palette.background.toUpperCase(), "#FFFFFF"),
    text: safeColor(result.palette.text.toUpperCase(), "#16161A"),
    accent: safeColor(result.palette.accent.toUpperCase(), "#4F46E5"),
  };

  return {
    name: result.name.slice(0, 80),
    style: { palette, titleFont: result.titleFont, align: result.align, verticalAlign: result.verticalAlign, decor: result.decor },
    customLayout: {
      name: result.name.slice(0, 80),
      html: sanitizeLayoutHtml(result.html).slice(0, 20_000),
      css: sanitizeLayoutCss(result.css).slice(0, 20_000),
    },
    icon: result.suggestedIcon === "nenhum" ? null : result.suggestedIcon,
  };
}
