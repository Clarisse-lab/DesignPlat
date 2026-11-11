// Estilos de referência (tabela design_estilos): a linguagem visual que o Gerar carrossel e o
// Gerar com IA seguem. Cada cliente tem um estilo padrão e pode ter outros; estilos sem cliente
// são da agência e servem para qualquer um. O kit de marca (logo, nome, @) continua o do cliente.

import { z } from "zod";
import { IMAGE_STYLES } from "./ai/image-direction";
import { freeSlideSchema } from "./feed/schema";
import { TITLE_FONT_IDS, type TitleFontId } from "./templates/fonts";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** Telas próprias do estilo (salvas a partir de um carrossel editado): capa, internas e fechamento. */
export const estiloLayoutsSchema = z.object({
  capa: freeSlideSchema.nullish(),
  internos: z.array(freeSlideSchema).max(4).default([]),
  final: freeSlideSchema.nullish(),
});
export type EstiloLayouts = z.infer<typeof estiloLayoutsSchema>;

export const hasLayouts = (l: EstiloLayouts | null | undefined): l is EstiloLayouts => Boolean(l && (l.capa || l.internos.length || l.final));

export const estiloDadosSchema = z.object({
  /** Modelos prontos do Livre que o estilo usa (a IA escolhe só entre eles). Vazio quando o estilo tem telas próprias. */
  modelos: z.array(z.string().max(60)).max(30).default([]),
  /** Telas próprias: quando existem, mandam no lugar dos modelos. */
  layouts: estiloLayoutsSchema.optional(),
  /** Cores e fonte de título que o estilo aplica no carrossel. */
  feed: z
    .object({
      palette: z.object({ background: hex, text: hex, accent: hex }).optional(),
      titleFont: z.enum(TITLE_FONT_IDS as [TitleFontId, ...TitleFontId[]]).optional(),
    })
    .default({}),
  imagem: z
    .object({
      /** Estilo das imagens geradas (Gemini). */
      estilo: z.enum(IMAGE_STYLES).default("auto"),
      /** Como a IA de texto deve descrever as imagens de cada tela. */
      cena: z.string().max(1500).default(""),
    })
    .optional(),
  /** Tom e regras de texto (vai para a IA que escreve as telas). */
  texto: z.string().max(3000).default(""),
}).refine((d) => d.modelos.length > 0 || hasLayouts(d.layouts), { message: "O estilo precisa de modelos ou de telas próprias." });
export type EstiloDados = z.infer<typeof estiloDadosSchema>;

export interface Estilo {
  id: string;
  nome: string;
  descricao: string | null;
  cliente_slug: string | null;
  padrao: boolean;
  dados: EstiloDados;
}
