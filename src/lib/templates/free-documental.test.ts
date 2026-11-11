import { describe, expect, it } from "vitest";
import { buildPreset, renderFreeSlide } from "./free";

const brand = { name: "Fellipe Barcelos de Cristo", handle: "barcelosdecristo", logo: null };
const palette = { background: "#0F2338", text: "#F3E7CF", accent: "#F2B33D" };
const render = (free: ReturnType<typeof buildPreset>, image: string | null = null) =>
  renderFreeSlide({ free, image, brand, palette, titleFont: "display", width: 1080, height: 1350, index: 1, total: 6, fontCss: "" });

describe("Foto documental", () => {
  it("duas fotos empilhadas escurecidas, frase de cima no título e de baixo no texto", () => {
    const free = buildPreset("doc-dividida", { title: "“Eu nunca termino nada.”", body: "“Eu concluo em pequenos passos.”", hasImage: true }, { placeholders: false });
    const grade = free.elements.find((e) => e.kind === "grade");
    expect(grade?.grid).toBe("2h");
    expect(grade?.dim).toBeGreaterThan(0);
    free.elements = free.elements.map((e) => (e.kind === "grade" ? { ...e, images: ["data:image/png;base64,iVBORw0KGgo=", "data:image/png;base64,iVBORw0KGgo="] } : e));
    const html = render(free);
    expect(html).toContain("rgba(0,0,0,0.42)");
    expect(html).toContain("Eu nunca termino nada.");
    expect(html).toContain("@barcelosdecristo");
  });

  it("capa usa a fonte de marcador sobre a foto; fechamento é escuro com botão", () => {
    const capa = buildPreset("doc-capa", { title: "Crenças **na bala**", body: "Crenças procrastinadoras ×", hasImage: true });
    expect(capa.bg).toBe("foto");
    expect(render(capa, "data:image/png;base64,iVBORw0KGgo=")).toContain("Permanent Marker");
    const final = buildPreset("doc-final", { title: "Na **Mentoria Na Bala**", body: "Quer viver na bala?", hasImage: false });
    expect(final.bg).toBe("grao");
    expect(final.elements.some((e) => e.kind === "etiqueta")).toBe(true);
  });
});
