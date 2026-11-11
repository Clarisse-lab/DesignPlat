// Estilos de referência (tabela design_estilos): a linguagem visual que o Gerar carrossel e o
// Gerar com IA seguem. Cada cliente tem um estilo padrão e pode ter outros; estilos sem cliente
// são da agência e servem para qualquer um. O kit de marca (logo, nome, @) continua o do cliente.

import { z } from "zod";
import { IMAGE_STYLES } from "./ai/image-direction";
import { TITLE_FONT_IDS, type TitleFontId } from "./templates/fonts";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const estiloDadosSchema = z.object({
  /** Modelos do Livre que o estilo usa (a IA escolhe só entre eles). */
  modelos: z.array(z.string().max(60)).min(1).max(30),
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
});
export type EstiloDados = z.infer<typeof estiloDadosSchema>;

export interface Estilo {
  id: string;
  nome: string;
  descricao: string | null;
  cliente_slug: string | null;
  padrao: boolean;
  dados: EstiloDados;
}
