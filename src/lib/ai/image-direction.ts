// Direção de arte das imagens geradas com IA (Gemini). Ideias adaptadas da ads-creative-factory
// (repositório marketingLendario/cohort-de-marketing, MIT, Rafael Costa):
// - a IA gera só a cena, sem texto, e deixa livre a ZONA onde o layout põe o texto;
// - um ESTILO por pedido (foto natural, editorial, produto, conceito);
// - EIXOS de variação (luz, enquadramento, fundo) sorteados sem repetir, para o lote não ficar igual;
// - o rosto do cliente é preservado e só o ambiente muda.
// Tudo genérico: as cores vêm do kit do cliente, nunca de uma estética fixa.

import type { FreeElement, FreeSlide } from "../templates/free";

// ---------- Zona do texto ----------

export const TEXT_ZONES = ["inferior", "superior", "esquerda", "direita", "centro", "nenhuma"] as const;
export type TextZone = (typeof TEXT_ZONES)[number];

export const TEXT_ZONE_LABELS: Record<TextZone, string> = {
  inferior: "Embaixo",
  superior: "Em cima",
  esquerda: "À esquerda",
  direita: "À direita",
  centro: "No centro",
  nenhuma: "Sem texto por cima",
};

const ZONE_PROMPTS: Record<TextZone, string> = {
  inferior:
    "Reserve the LOWER 40% of the frame for a headline: keep it calm, uncluttered and slightly darker; place the main subject in the upper part and never let it cross into the lower area.",
  superior:
    "Reserve the UPPER 40% of the frame for a headline: keep it calm and uncluttered (soft sky, wall, blurred background); place the main subject in the lower part.",
  esquerda:
    "Reserve the LEFT 55% of the frame for a text column: keep it calm, uncluttered and evenly lit; place the main subject only in the right third and never let it cross into the left side.",
  direita:
    "Reserve the RIGHT 55% of the frame for a text column: keep it calm, uncluttered and evenly lit; place the main subject only in the left third and never let it cross into the right side.",
  centro:
    "Keep the CENTER of the frame calm and uncluttered for a centered headline; frame the subject around the edges or as a soft, out-of-focus background.",
  nenhuma: "The image is shown on its own (no text over it): use the whole frame for the subject.",
};

const TEXT_ELEMENT_KINDS = new Set<FreeElement["kind"]>(["titulo", "texto", "etiqueta", "conversa"]);

/**
 * Onde o texto do slide Livre está: a IA deixa essa área livre na foto de fundo.
 * Usa a área de cada elemento de texto (largura × tamanho da fonte) como peso.
 */
export function textZoneOfFree(free: Pick<FreeSlide, "elements"> | null | undefined): TextZone {
  const texts = (free?.elements ?? []).filter((el) => TEXT_ELEMENT_KINDS.has(el.kind) && (el.kind === "conversa" || (el.text ?? "").trim()));
  if (!texts.length) return "nenhuma";
  let weight = 0;
  let cx = 0;
  let cy = 0;
  let minX = 100;
  let maxX = 0;
  for (const el of texts) {
    const w = Math.max(2, el.w);
    // Altura aproximada do bloco: elementos com altura usam a deles; texto, um múltiplo da fonte.
    const h = el.h ?? Math.max(3, ((el.size ?? 40) / 1080) * 100 * 2.4);
    const area = w * h;
    weight += area;
    cx += (el.x + w / 2) * area;
    cy += (el.y + h / 2) * area;
    minX = Math.min(minX, el.x);
    maxX = Math.max(maxX, el.x + w);
  }
  cx /= weight;
  cy /= weight;
  const span = maxX - minX;
  // Coluna estreita de um lado só vira zona lateral.
  if (span <= 62 && cx < 42) return "esquerda";
  if (span <= 62 && cx > 58) return "direita";
  if (cy >= 55) return "inferior";
  if (cy <= 42) return "superior";
  return "centro";
}

// ---------- Estilos ----------

export const IMAGE_STYLES = ["auto", "natural", "editorial", "produto", "conceito"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

export const IMAGE_STYLE_LABELS: Record<ImageStyle, { label: string; hint: string }> = {
  auto: { label: "Automático", hint: "Segue só a descrição" },
  natural: { label: "Foto natural", hint: "Cara de foto de celular, do dia a dia" },
  editorial: { label: "Editorial", hint: "Foto de revista, luz pensada" },
  produto: { label: "Produto / objeto", hint: "Objeto em destaque, still" },
  conceito: { label: "Conceito", hint: "Metáfora visual da ideia" },
};

const STYLE_PROMPTS: Record<ImageStyle, string> = {
  auto: "",
  natural:
    "STYLE: candid smartphone photo of real everyday life. Natural everyday tones, subtle phone-camera grain, slightly imperfect unposed framing, lived-in real details. It must NOT look like a studio ad or a generic stock photo.",
  editorial:
    "STYLE: premium editorial magazine photograph. Intentional lighting, refined color grading, shallow depth of field, strong focal point, generous negative space.",
  produto:
    "STYLE: high-end product still life. One hero object, clean considered set, controlled soft shadows, tactile materials and texture, crisp focus on the object.",
  conceito:
    "STYLE: conceptual visual metaphor of the idea, simple and bold, one clear focal element, artful lighting; no literal infographic and no text.",
};

// ---------- Eixos de variação ----------

interface AxisValue {
  id: string;
  fragment: string;
}

/** Valores neutros (sem cor fixa): a paleta vem do kit do cliente. */
export const VARIATION_AXES: Record<"luz" | "enquadramento" | "fundo", AxisValue[]> = {
  luz: [
    { id: "janela", fragment: "soft natural window light from one side" },
    { id: "dourada", fragment: "warm golden-hour light with long soft shadows" },
    { id: "estudio", fragment: "soft diffused studio light, gentle falloff" },
    { id: "lateral", fragment: "dramatic side light with deep but clean shadows" },
    { id: "contraluz", fragment: "backlight creating a soft glowing rim around the subject" },
    { id: "nublado", fragment: "even overcast daylight, calm and soft" },
  ],
  enquadramento: [
    { id: "tercos", fragment: "rule-of-thirds composition with the subject offset" },
    { id: "detalhe", fragment: "close-up detail shot with shallow depth of field" },
    { id: "ambiente", fragment: "wider environmental shot that shows the place" },
    { id: "cima", fragment: "clean top-down view" },
    { id: "baixo", fragment: "slightly low angle hero perspective" },
    { id: "frontal", fragment: "straight-on eye-level framing" },
  ],
  fundo: [
    { id: "textura", fragment: "background with real surface texture (wall, fabric, wood or paper grain)" },
    { id: "profundidade", fragment: "softly blurred background with visible depth and layers" },
    { id: "atmosfera", fragment: "background with subtle atmosphere (haze, light falloff, gentle gradient with grain)" },
    { id: "lugar", fragment: "real place in the background, out of focus but recognizable" },
  ],
};

export type VariationKey = string;

const keyOf = (sel: Record<keyof typeof VARIATION_AXES, string>) => `${sel.luz}|${sel.enquadramento}|${sel.fundo}`;

/**
 * Sorteia uma combinação de luz, enquadramento e fundo que ainda não foi usada (`avoid`).
 * `random` é injetável para teste.
 */
export function pickVariation(avoid: readonly string[] = [], random: () => number = Math.random): { key: VariationKey; fragments: string[] } {
  const used = new Set(avoid);
  const pick = <T,>(list: T[]) => list[Math.floor(random() * list.length) % list.length];
  let sel = { luz: "", enquadramento: "", fundo: "" };
  for (let attempt = 0; attempt < 40; attempt++) {
    sel = { luz: pick(VARIATION_AXES.luz).id, enquadramento: pick(VARIATION_AXES.enquadramento).id, fundo: pick(VARIATION_AXES.fundo).id };
    if (!used.has(keyOf(sel))) break;
  }
  const frag = (axis: keyof typeof VARIATION_AXES) => VARIATION_AXES[axis].find((v) => v.id === sel[axis])?.fragment ?? "";
  return { key: keyOf(sel), fragments: [frag("luz"), frag("enquadramento"), frag("fundo")] };
}

// ---------- Montagem do pedido ----------

const BASE_RULES = [
  "Create a single high-quality image for an Instagram post.",
  "Absolutely no text, letters, numbers, captions, logos, UI or watermarks anywhere in the image.",
  "Do not depict any real, identifiable public figure or celebrity.",
  "The background must have real texture, depth or atmosphere: never a flat, empty, uniform color.",
  "Avoid the generic AI look: no plastic skin, no oversaturated neon purple or blue glow, no extra or malformed fingers, no surreal clutter.",
].join(" ");

const FACE_RULE =
  "The person must be the SAME person shown in the reference photo(s): keep the face, eyes, glasses, hair, expression, skin tone and age faithful and recognizable. Do not regenerate, beautify, slim or age the face. Do not add other identifiable people.";

const EDIT_RULE =
  "Edit the FIRST image provided. Apply only the change requested below and keep everything else (people, faces, composition, framing) exactly as it is. No text, letters, logos or watermarks.";

export interface ImageDirectionInput {
  prompt: string;
  aspectRatio: string;
  hasFaces: boolean;
  hasReferences: boolean;
  paletteHint?: string;
  editing: boolean;
  textZone?: TextZone;
  style?: ImageStyle;
  /** Fragmentos de variação já sorteados (ver pickVariation). */
  variation?: string[];
}

/** Monta as instruções em inglês que vão para o Gemini, com o pedido da equipe no fim. */
export function buildImageInstructions(input: ImageDirectionInput): string {
  const wide = input.aspectRatio === "21:9" || input.aspectRatio === "16:9";
  if (input.editing) {
    return [
      EDIT_RULE,
      input.hasFaces ? FACE_RULE : "",
      `Change requested by the user (Portuguese): ${input.prompt}`,
    ]
      .filter(Boolean)
      .join("\n");
  }
  const zone = wide ? null : ZONE_PROMPTS[input.textZone ?? "inferior"];
  return [
    BASE_RULES,
    zone ? `TEXT AREA: ${zone}` : "",
    STYLE_PROMPTS[input.style ?? "auto"],
    input.variation?.length ? `LOOK (unless the user's description says otherwise): ${input.variation.filter(Boolean).join("; ")}.` : "",
    input.hasFaces ? FACE_RULE : "",
    input.hasReferences ? "Use the other reference image(s) only as visual style/composition inspiration." : "",
    input.paletteHint ? `Brand colors to echo subtly in props, clothing or light (never as a flat fill): ${input.paletteHint}.` : "",
    wide ? "This is a wide panorama that will be split into side-by-side Instagram carousel slides: spread the scene continuously across the whole width." : "",
    `Scene requested by the user (Portuguese): ${input.prompt}`,
  ]
    .filter(Boolean)
    .join("\n");
}
