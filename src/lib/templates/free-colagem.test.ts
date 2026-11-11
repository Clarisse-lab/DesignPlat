import { describe, expect, it } from "vitest";
import { buildPreset, fitFontSize, renderFreeSlide } from "./free";

const brand = { name: "Sabrina Nascimento", handle: "eusousabrinanascimento", logo: null };
const palette = { background: "#F1EEE9", text: "#1F1B18", accent: "#E8736C" };
const render = (free: ReturnType<typeof buildPreset>) =>
  renderFreeSlide({ free, image: null, brand, palette, titleFont: "maquina", width: 1080, height: 1350, index: 0, total: 5, fontCss: "" });

describe("fitFontSize", () => {
  it("mantém o tamanho base quando cabe e encolhe título longo", () => {
    expect(fitFontSize("Título curto", 100, 86, 26, 0.62, 1.08)).toBe(100);
    const longo = fitFontSize("Antes de contratar uma agência, faça estas **5 perguntas** que quase ninguém faz", 100, 86, 26, 0.62, 1.08);
    expect(longo).toBeLessThan(100);
    expect(longo).toBeGreaterThanOrEqual(36);
  });
});

describe("Colagem editorial", () => {
  it("capa: papel, recorte, título com caneta e @ no rodapé", () => {
    const free = buildPreset("colagem-capa", { title: "**7 coisas** do marketing", body: "que você não deveria reproduzir", hasImage: true });
    expect(free.bg).toBe("papel");
    expect(free.elements.find((e) => e.kind === "imagem")?.cutout).toBe(true);
    const html = render(free);
    expect(html).toContain("feTurbulence");
    expect(html).toContain("hl-caneta");
    expect(html).toContain("@eusousabrinanascimento");
  });

  it("item: título inteiro na caneta quando não marca palavras", () => {
    const free = buildPreset("colagem-item", { title: "1. Inventar urgência", body: "Texto", hasImage: true }, { placeholders: false });
    expect(free.elements.find((e) => e.kind === "titulo")?.text).toBe("**1. Inventar urgência**");
  });

  it("recorte com imagem mistura no papel; fechamento usa o papel no tom do destaque", () => {
    const free = buildPreset("colagem-item", { title: "1. Teste", body: "Texto", hasImage: true });
    free.elements = free.elements.map((e) => (e.kind === "imagem" ? { ...e, image: "data:image/png;base64,iVBORw0KGgo=" } : e));
    expect(render(free)).toContain("mix-blend-mode:multiply");
    expect(buildPreset("colagem-final", { title: "Fim", body: "comente CONSULTORIA", hasImage: false }).bg).toBe("papel-destaque");
  });

  it("escuro com grão deixa o texto claro", () => {
    const free = buildPreset("interno-texto", { title: "Oi", body: "Texto", hasImage: false });
    free.bg = "grao";
    expect(render(free)).toContain("color:#F5F5F4");
  });
});

describe("Capa da colagem com mais peso", () => {
  it("tem mancha de tinta, título maior que o do item e linha de apoio em faixa", () => {
    const capa = buildPreset("colagem-capa", { title: "**7 coisas** do marketing", body: "que você não deveria reproduzir", hasImage: true });
    const item = buildPreset("colagem-item", { title: "1. Item", body: "Texto", hasImage: true });
    expect(capa.elements[0].kind).toBe("mancha");
    const size = (f: typeof capa) => f.elements.find((e) => e.kind === "titulo")?.size ?? 0;
    expect(size(capa)).toBeGreaterThan(size(item) * 1.5);
    const html = render(capa);
    expect(html).toContain("hl-faixa");
    expect(html).toContain("feDisplacementMap");
  });
});
