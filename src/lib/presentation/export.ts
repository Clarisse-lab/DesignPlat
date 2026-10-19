import "server-only";
import { PDFDocument } from "pdf-lib";
import PptxGenJS from "pptxgenjs";

/** Junta PDFs de uma página (um por slide) num único arquivo. */
export async function mergePdfPages(pages: Buffer[], title: string): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  merged.setTitle(title);
  merged.setCreator("Design Mantora");
  for (const page of pages) {
    const source = await PDFDocument.load(page);
    const copied = await merged.copyPages(source, source.getPageIndices());
    copied.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

/**
 * Monta um PowerPoint 16:9 com cada slide como imagem de tela cheia (fiel ao preview)
 * e as notas do apresentador nas anotações de cada slide.
 */
export async function buildPptx(slides: { png: Buffer; notes?: string | null }[], title: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13,333 × 7,5 pol (16:9)
  pptx.title = title;
  pptx.company = "Design Mantora";
  for (const { png, notes } of slides) {
    const slide = pptx.addSlide();
    slide.addImage({ data: `data:image/png;base64,${png.toString("base64")}`, x: 0, y: 0, w: "100%", h: "100%" });
    if (notes?.trim()) slide.addNotes(notes.trim());
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
