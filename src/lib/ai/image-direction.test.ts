import { describe, expect, it } from "vitest";
import { buildPreset } from "../templates/free";
import { buildImageInstructions, pickVariation, textZoneOfFree } from "./image-direction";

describe("textZoneOfFree", () => {
  it("acha onde o texto do slide está", () => {
    expect(textZoneOfFree({ elements: [] })).toBe("nenhuma");
    expect(textZoneOfFree(buildPreset("capa-revista", { title: "", body: "", hasImage: true }))).toBe("inferior");
    expect(textZoneOfFree(buildPreset("interno-citacao-foto", { title: "", body: "", hasImage: false }))).toBe("direita");
    expect(textZoneOfFree({ elements: [{ id: "t", kind: "titulo", x: 6, y: 10, w: 50, size: 80, text: "Oi" }] })).toBe("esquerda");
    expect(textZoneOfFree({ elements: [{ id: "t", kind: "titulo", x: 8, y: 8, w: 84, size: 80, text: "Oi" }] })).toBe("superior");
  });

  it("ignora texto vazio", () => {
    expect(textZoneOfFree({ elements: [{ id: "t", kind: "titulo", x: 8, y: 8, w: 84, size: 80, text: "  " }] })).toBe("nenhuma");
  });
});

describe("pickVariation", () => {
  it("não repete combinação já usada", () => {
    const used: string[] = [];
    for (let i = 0; i < 30; i++) {
      const v = pickVariation(used);
      expect(used).not.toContain(v.key);
      expect(v.fragments).toHaveLength(3);
      used.push(v.key);
    }
  });
});

describe("buildImageInstructions", () => {
  const base = { prompt: "a cliente no consultório", aspectRatio: "4:5", hasFaces: false, hasReferences: false, editing: false };

  it("reserva a zona do texto e mantém o pedido da equipe no fim", () => {
    const text = buildImageInstructions({ ...base, textZone: "esquerda", style: "natural" });
    expect(text).toContain("LEFT 55%");
    expect(text).toContain("smartphone photo");
    expect(text.trim().endsWith("a cliente no consultório")).toBe(true);
  });

  it("sem zona, deixa o texto embaixo (comportamento anterior)", () => {
    expect(buildImageInstructions(base)).toContain("LOWER 40%");
  });

  it("panorama não reserva zona e editar não sorteia estilo", () => {
    expect(buildImageInstructions({ ...base, aspectRatio: "21:9" })).not.toContain("TEXT AREA");
    const edit = buildImageInstructions({ ...base, editing: true, style: "editorial", hasFaces: true });
    expect(edit).not.toContain("STYLE");
    expect(edit).toContain("SAME person");
  });
});
