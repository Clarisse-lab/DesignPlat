import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { buildPptx, mergePdfPages } = await import("./export");

// PNG de 1×1 pixel
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

describe("buildPptx", () => {
  it("cria um slide por imagem e guarda as notas do apresentador", async () => {
    const file = await buildPptx([{ png: PNG, notes: "Falar dos números" }, { png: PNG }], "Teste");
    const zip = await JSZip.loadAsync(file);
    const slides = Object.keys(zip.files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name));
    expect(slides).toHaveLength(2);
    const notes = await Promise.all(
      Object.keys(zip.files)
        .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
        .map((name) => zip.file(name)!.async("string")),
    );
    expect(notes.some((xml) => xml.includes("Falar dos números"))).toBe(true);
  });
});

describe("mergePdfPages", () => {
  it("junta os PDFs na ordem", async () => {
    const page = async (w: number) => {
      const doc = await PDFDocument.create();
      doc.addPage([w, 100]);
      return Buffer.from(await doc.save());
    };
    const merged = await PDFDocument.load(await mergePdfPages([await page(100), await page(200)], "Teste"));
    expect(merged.getPages().map((p) => p.getWidth())).toEqual([100, 200]);
    expect(merged.getTitle()).toBe("Teste");
  });
});
