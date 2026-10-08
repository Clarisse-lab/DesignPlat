import { describe, expect, it } from "vitest";
import { inferLayout, type TextLine } from "./layout";
import { extractPalette } from "./palette";

function image(width: number, height: number, paint: (x: number, y: number) => [number, number, number]) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = paint(x, y);
      pixels.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return pixels;
}

describe("extractPalette", () => {
  it("acha fundo nas bordas, texto contrastante e destaque saturado", () => {
    // fundo creme, faixa de "texto" escuro e um bloco laranja no meio
    const pixels = image(100, 100, (x, y) => {
      if (y > 40 && y < 50 && x > 20 && x < 80) return [30, 25, 20];
      if (y > 60 && y < 80 && x > 30 && x < 70) return [230, 90, 20];
      return [245, 238, 228];
    });
    const palette = extractPalette(pixels, 100, 100);
    expect(palette.background).toBe("#F5EEE4");
    expect(palette.text).toBe("#1E1914");
    expect(palette.accent).toBe("#E65A14");
  });

  it("devolve destaque nulo quando a imagem não tem cor viva", () => {
    const pixels = image(50, 50, (x) => (x < 25 ? [255, 255, 255] : [20, 20, 20]));
    expect(extractPalette(pixels, 50, 50).accent).toBeNull();
  });
});

const line = (text: string, x0: number, y0: number, x1: number, y1: number): TextLine => ({ text, confidence: 90, x0, y0, x1, y1 });

describe("inferLayout", () => {
  it("título grande centralizado e sozinho vira Destaque centralizado", () => {
    const result = inferLayout(
      [line("Sua marca precisa", 200, 600, 880, 700), line("de consistência", 240, 710, 840, 810)],
      1080,
      1350,
    );
    expect(result).toMatchObject({ layout: "destaque", align: "center", verticalAlign: "center" });
  });

  it("título e parágrafo alinhados à esquerda no topo viram Texto", () => {
    const result = inferLayout(
      [
        line("Como crescer no Instagram", 90, 120, 900, 190),
        line("Publicar todos os dias não basta se cada post", 90, 230, 960, 262),
        line("parece de uma marca diferente.", 90, 270, 700, 302),
      ],
      1080,
      1350,
    );
    expect(result).toMatchObject({ layout: "texto", align: "left", verticalAlign: "top" });
  });

  it("reconhece número, lista e citação", () => {
    expect(inferLayout([line("+37%", 100, 500, 600, 700), line("de alcance em 30 dias", 100, 760, 700, 800)], 1080, 1350)?.layout).toBe("numero");
    expect(
      inferLayout(
        [
          line("Checklist", 100, 200, 600, 280),
          line("1. Defina a paleta", 100, 400, 600, 430),
          line("2. Escolha a fonte", 100, 450, 600, 480),
          line("3. Crie templates", 100, 500, 600, 530),
        ],
        1080,
        1350,
      )?.layout,
    ).toBe("lista");
    expect(inferLayout([line("“Marca forte se reconhece", 100, 500, 900, 580)], 1080, 1350)?.layout).toBe("citacao");
  });

  it("ignora leituras ruins e devolve null sem texto", () => {
    expect(inferLayout([{ ...line("ab", 0, 0, 10, 10), confidence: 20 }], 1080, 1350)).toBeNull();
  });
});
