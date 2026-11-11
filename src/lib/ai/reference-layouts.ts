import "server-only";
// Copia o estilo de um carrossel de referência (capa, tela interna e fechamento) como telas do
// layout Livre: elementos editáveis, que a equipe ajusta e salva como estilo. Substitui o antigo
// "Copiar estilo com IA", que gerava um HTML fixo (não editável) e só de uma tela.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CANVAS_SIZES, type PostCanvasSizeId } from "../formats";
import type { FeedPalette } from "../templates/feed";
import { TITLE_FONT_IDS, TITLE_FONTS, type TitleFontId } from "../templates/fonts";
import {
  FREE_COLORS,
  FREE_HIGHLIGHTS,
  FREE_OVERLAYS,
  FREE_PROFILE_VARIANTS,
  newElementId,
  type FreeElement,
  type FreeSlide,
} from "../templates/free";
import { ICON_IDS, type IconId } from "../templates/icons";
import { safeColor } from "../templates/utils";
import { anthropic, CLAUDE_MODEL, GenerationError } from "./claude";

export const REFERENCE_ROLES = ["capa", "interno", "final"] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

const KINDS = ["titulo", "texto", "etiqueta", "perfil", "numeracao", "arraste", "imagem", "cartao", "icone"] as const;
const BACKGROUNDS = ["fundo", "destaque", "foto", "papel", "papel-destaque", "grao"] as const;

// Sem campos opcionais nem nulos (a saída estruturada limita uniões): "vazio" é 0, "" ou "padrao".
const elementSchema = z.object({
  kind: z.enum(KINDS),
  x: z.number().describe("Esquerda, em % da largura"),
  y: z.number().describe("Topo, em % da altura"),
  w: z.number().describe("Largura, em % da largura"),
  h: z.number().describe("Altura em % da altura (imagem e cartão); 0 nos textos"),
  text: z.string().describe("Texto, copiado da referência; ** em volta das palavras destacadas; vazio se não tem"),
  size: z.number().describe("Tamanho da fonte em px (canvas de 1080 de largura); 0 se não tem texto"),
  align: z.enum(["left", "center", "right"]),
  color: z.enum(FREE_COLORS),
  highlight: z.enum(FREE_HIGHLIGHTS),
  upper: z.boolean(),
  family: z.enum(["padrao", "corpo", ...TITLE_FONT_IDS] as [string, ...string[]]),
  fill: z.enum(["nenhum", "vidro", ...FREE_COLORS] as [string, ...string[]]),
  radius: z.number(),
  variant: z.enum(FREE_PROFILE_VARIANTS),
  dim: z.number().describe("Escurecimento da foto em % (só imagem); 0 sem"),
  icon: z.enum(ICON_IDS as [IconId, ...IconId[]]).describe("Só no elemento icone; nos outros, brilho"),
});

const resultSchema = z.object({
  name: z.string().describe("Nome curto do estilo, em português"),
  palette: z.object({
    background: z.string().describe("#RRGGBB"),
    text: z.string().describe("#RRGGBB"),
    accent: z.string().describe("#RRGGBB"),
  }),
  titleFont: z.enum(TITLE_FONT_IDS as [TitleFontId, ...TitleFontId[]]),
  slides: z.array(
    z.object({
      papel: z.enum(REFERENCE_ROLES),
      bg: z.enum(BACKGROUNDS),
      overlay: z.enum(FREE_OVERLAYS),
      elements: z.array(elementSchema),
    }),
  ),
});

function systemPrompt(width: number, height: number): string {
  const fonts = TITLE_FONT_IDS.map((id) => `- "${id}": ${TITLE_FONTS[id].label}`).join("\n");
  return `Você é designer de social media. Recebe telas de um carrossel de Instagram usado como referência (capa, tela interna e/ou fechamento) e recria cada uma como uma tela do editor "Livre": uma lista de elementos posicionados. A equipe vai editar o resultado e usar como estilo, com outros textos.

O canvas tem ${width}×${height} px. Posições em %: x e w da largura, y e h da altura; (x, y) é o canto superior esquerdo do elemento. Textos crescem para baixo a partir de y e quebram linha dentro de w. Tamanhos de fonte em px desse canvas (um título grande tem 80 a 130; texto corrido, 30 a 44; rodapé, 18 a 24).

Elementos:
- titulo: o título da tela. Use a fonte de títulos (family "padrao") ou outra se a referência pedir.
- texto: qualquer outro texto (apoio, lista com "→", rodapé, data, "Powered by..."). Fonte Inter (family "padrao" ou "corpo"); use uma fonte de título em family só se for claramente outra fonte.
- etiqueta: texto curto dentro de uma pílula colorida (fill = cor da pílula).
- perfil: foto redonda + nome + @ da marca (variant "linha"), pílula com foto e @ ("chip") ou cabeçalho de tweet ("tweet").
- numeracao: "2/8" da tela. arraste: "Arraste →".
- imagem: área de foto retangular (h obrigatório, radius em px, dim para escurecer).
- cartao: retângulo de cor (fill); use também para linhas e divisórias (h 0.15 a 0.4, radius 0).
- icone: um ícone simples da lista (icon) no tamanho size. Setas e outros símbolos dentro de um texto vão como caractere no próprio texto (→, ✦).
Para mostrar o @ da marca dentro de um texto, escreva {usuario}; o nome da marca, {nome}.

Cores (color do texto, fill de etiqueta e cartão) são da paleta: "texto", "fundo", "destaque", ou "branco" / "preto". Escolha a palette (fundo, texto e destaque em #RRGGBB) a partir da referência, para que essas cores batam.
Destaque de palavras: coloque ** em volta delas no texto e escolha highlight: "cor" (na cor de destaque), "marca" (marca-texto), "negrito", "caneta" (faixa clara atrás) ou "faixa" (faixa sólida, texto branco).
Fundo (bg): "fundo" (cor de fundo lisa), "destaque" (cor de destaque), "foto" (foto inteira atrás; overlay escurece: "nenhuma", "suave", "base", "forte", "total"), "papel" / "papel-destaque" (papel amassado), "grao" (escuro com grão).

Fontes de título (titleFont, a mais parecida com a da referência):
${fonts}

Regras:
- Uma tela em "slides" para cada imagem recebida, com o papel indicado (capa, interno ou final).
- Copie os textos da referência como estão (mesmo idioma e tamanho): eles mostram quanto texto cabe em cada lugar.
- Reproduza posições, tamanhos, cores, alinhamento e divisórias com fidelidade; não "melhore" o design.
- Fotos da referência viram imagem (área de foto) ou bg "foto"; não descreva a foto.
- Campos sem uso: h 0, text "", size 0, radius 0, dim 0, fill "nenhum", family "padrao", variant "linha", icon "brilho", highlight "cor", upper false, color "texto".
- No máximo 14 elementos por tela.`;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
const DEFAULT_SIZE: Partial<Record<FreeElement["kind"], number>> = { titulo: 96, texto: 36, etiqueta: 26, perfil: 24, numeracao: 22, arraste: 22, icone: 64 };

function toElement(raw: z.infer<typeof elementSchema>): FreeElement {
  const kind = raw.kind;
  const out: FreeElement = {
    id: newElementId(),
    kind,
    x: clamp(raw.x, -10, 100),
    y: clamp(raw.y, -10, 100),
    w: clamp(raw.w, 1, 120),
  };
  if (kind === "imagem" || kind === "cartao") out.h = clamp(raw.h || (kind === "imagem" ? 35 : 10), 0.1, 120);
  if (raw.text.trim() && kind !== "numeracao" && kind !== "imagem" && kind !== "cartao") out.text = raw.text.slice(0, 1500);
  const size = raw.size > 0 ? raw.size : DEFAULT_SIZE[kind];
  if (size) out.size = clamp(size, 10, 300);
  if (raw.align !== "left") out.align = raw.align;
  if (raw.color !== "texto") out.color = raw.color;
  if (raw.highlight !== "cor") out.highlight = raw.highlight;
  if (raw.upper) out.upper = true;
  if (raw.family !== "padrao") out.family = raw.family as FreeElement["family"];
  if (raw.fill !== "nenhum") out.fill = raw.fill as FreeElement["fill"];
  else if (kind === "cartao") out.fill = "texto";
  if (kind === "imagem" || kind === "cartao" || kind === "etiqueta") out.radius = clamp(raw.radius, 0, 200);
  if (kind === "perfil") out.variant = raw.variant;
  if (kind === "imagem" && raw.dim > 0) out.dim = clamp(raw.dim, 0, 80);
  if (kind === "icone") out.icon = raw.icon;
  return out;
}

export interface ReferenceLayoutsResult {
  name: string;
  palette: FeedPalette;
  titleFont: TitleFontId;
  layouts: { capa: FreeSlide | null; internos: FreeSlide[]; final: FreeSlide | null };
}

export async function layoutsFromReference(input: {
  images: { role: ReferenceRole; base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" }[];
  size: PostCanvasSizeId;
}): Promise<ReferenceLayoutsResult> {
  const { width, height } = CANVAS_SIZES[input.size];
  const label: Record<ReferenceRole, string> = { capa: "CAPA", interno: "TELA INTERNA", final: "FECHAMENTO" };
  const content = input.images.flatMap((img) => [
    { type: "text" as const, text: `Imagem a seguir: ${label[img.role]} (papel "${img.role}").` },
    { type: "image" as const, source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 } },
  ]);
  content.push({ type: "text" as const, text: "Recrie cada tela como elementos do Livre, seguindo as regras." });

  const response = await anthropic.beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: betaZodOutputFormat(resultSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: systemPrompt(width, height),
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new GenerationError("A IA não conseguiu analisar estas imagens. Tente outras referências.");
  if (response.stop_reason === "max_tokens") throw new GenerationError("A resposta da IA ficou incompleta. Tente novamente.");
  const result = response.parsed_output;
  if (!result?.slides.length) throw new GenerationError("A IA não devolveu telas válidas. Tente novamente.");

  const toSlide = (s: (typeof result.slides)[number]): FreeSlide => ({
    bg: s.bg,
    overlay: s.overlay,
    preset: null,
    pan: null,
    elements: s.elements.slice(0, 20).map(toElement),
  });
  const of = (role: ReferenceRole) => result.slides.filter((s) => s.papel === role).map(toSlide);
  return {
    name: result.name.slice(0, 80),
    palette: {
      background: safeColor(result.palette.background.toUpperCase(), "#FFFFFF"),
      text: safeColor(result.palette.text.toUpperCase(), "#16161A"),
      accent: safeColor(result.palette.accent.toUpperCase(), "#4F46E5"),
    },
    titleFont: result.titleFont,
    layouts: { capa: of("capa")[0] ?? null, internos: of("interno").slice(0, 4), final: of("final")[0] ?? null },
  };
}
