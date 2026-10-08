import { describe, expect, it } from "vitest";
import { FEED_PALETTES, renderFeedSlide, splitContentIntoSlides, type FeedStyle } from "./feed";
import { contrastText, safeColor } from "./utils";

const brand = { name: "Mantora Lab", handle: "@mantoralab", logo: null };
const style: FeedStyle = { size: "portrait-4x5", palette: FEED_PALETTES[0].palette, titleFont: "sans", showPageNumber: true };

describe("splitContentIntoSlides", () => {
  it("separa por linha em branco, usando a primeira linha como título", () => {
    const slides = splitContentIntoSlides("# Capa\nSubtítulo\n\nPonto 1\nExplicação\nmais texto");
    expect(slides).toHaveLength(2);
    expect(slides[0]).toMatchObject({ layout: "destaque", title: "Capa", body: "Subtítulo" });
    expect(slides[1]).toMatchObject({ layout: "texto", title: "Ponto 1", body: "Explicação\nmais texto" });
  });

  it("usa --- como separador quando presente, mantendo parágrafos no mesmo slide", () => {
    const slides = splitContentIntoSlides("Título A\n\nParágrafo 1\n\nParágrafo 2\n---\nTítulo B");
    expect(slides).toHaveLength(2);
    expect(slides[0].body).toBe("Parágrafo 1\n\nParágrafo 2");
  });

  it("devolve lista vazia para texto vazio", () => {
    expect(splitContentIntoSlides("   \n ")).toEqual([]);
  });
});

describe("renderFeedSlide", () => {
  it("mostra a numeração e o @ da marca", () => {
    const html = renderFeedSlide({ slide: { layout: "texto", title: "Oi", body: "**forte**" }, brand, style, index: 1, total: 3, fontCss: "" });
    expect(html).toContain("2/3");
    expect(html).toContain("@mantoralab");
    expect(html).toContain("<strong>forte</strong>");
  });

  it("ignora cores fora do formato #RRGGBB", () => {
    const evil = { ...style, palette: { background: "red;}</style><script>", text: "#000000", accent: "#4F46E5" } };
    const html = renderFeedSlide({ slide: { layout: "texto", title: "x", body: "" }, brand, style: evil, index: 0, total: 1, fontCss: "" });
    expect(html).not.toContain("<script>");
  });
});

describe("cores", () => {
  it("escolhe texto legível sobre o fundo", () => {
    expect(contrastText("#FFFFFF")).toBe("#111111");
    expect(contrastText("#4F46E5")).toBe("#FFFFFF");
    expect(safeColor("blue", "#000000")).toBe("#000000");
  });
});
