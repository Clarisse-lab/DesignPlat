import { describe, expect, it } from "vitest";
import { aggregateReadings, colorDistance, type Reading } from "./aggregate";

const creme = { background: "#F4EDE4", text: "#2B2118", accent: "#C2410C" };
const escuro = { background: "#16161A", text: "#F5F5F4", accent: "#C2410C" };
const layout = (over: Partial<NonNullable<Reading["layout"]>> = {}) => ({
  layout: "texto" as const,
  align: "left" as const,
  verticalAlign: "center" as const,
  titleScale: 1,
  ...over,
});

describe("aggregateReadings", () => {
  it("devolve null sem leituras", () => {
    expect(aggregateReadings([])).toBeNull();
  });

  it("escolhe o fundo mais recorrente e guarda o segundo como alternativa", () => {
    const kit = aggregateReadings([
      { weight: 1, palette: creme, layout: layout(), slot: "capa" },
      { weight: 1, palette: { ...creme, background: "#F2EBE1" }, layout: layout(), slot: "interna" },
      { weight: 1, palette: escuro, layout: layout(), slot: "capa" },
    ])!;
    expect(colorDistance(kit.palette.background, creme.background)).toBeLessThan(10);
    expect(kit.palette.text).toBe(creme.text);
    expect(kit.alternatives[0].background).toBe(escuro.background);
  });

  it("dá mais peso aos posts com nota maior", () => {
    const kit = aggregateReadings([
      { weight: 20, palette: escuro, layout: layout({ align: "center" }), slot: "capa" },
      { weight: 1, palette: creme, layout: layout(), slot: "capa" },
      { weight: 1, palette: creme, layout: layout(), slot: "capa" },
    ])!;
    expect(kit.palette.background).toBe(escuro.background);
    expect(kit.align).toBe("center");
  });

  it("conta os layouts mais usados e a mediana do tamanho do título", () => {
    const kit = aggregateReadings([
      { weight: 1, palette: creme, layout: layout({ layout: "destaque", titleScale: 1.2 }), slot: "capa" },
      { weight: 1, palette: creme, layout: layout({ layout: "lista", titleScale: 0.9 }), slot: "interna" },
      { weight: 1, palette: creme, layout: layout({ layout: "lista", titleScale: 1 }), slot: "interna" },
      { weight: 1, palette: creme, layout: null, slot: "capa" },
    ])!;
    expect(kit.layouts[0]).toBe("lista");
    expect(kit.layouts).toContain("destaque");
    expect(kit.titleScale).toBe(1);
  });

  it("marca a capa com fundo de destaque quando as capas usam a cor de destaque", () => {
    const kit = aggregateReadings([
      { weight: 1, palette: creme, layout: layout(), slot: "interna" },
      { weight: 1, palette: creme, layout: layout(), slot: "interna" },
      { weight: 1, palette: creme, layout: layout(), slot: "interna" },
      { weight: 1, palette: { background: "#C2410C", text: "#FFFFFF", accent: "#FFFFFF" }, layout: layout(), slot: "capa" },
    ])!;
    expect(kit.coverBackground).toBe("accent");
  });
});
