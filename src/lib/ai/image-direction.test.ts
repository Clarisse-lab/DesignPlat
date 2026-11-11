import { describe, expect, it } from "vitest";
import { buildPreset } from "../templates/free";
import { buildImageInstructions, overlayForZone, pickVariation, textZoneOfFree } from "./image-direction";

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
    expect(text).toContain("a cliente no consultório");
    // A regra da zona é repetida no fim, depois do pedido.
    expect(text.trim().split("\n").pop()).toContain("left 55%");
  });

  it("sem zona, deixa o texto embaixo (comportamento anterior)", () => {
    expect(buildImageInstructions(base)).toContain("LOWER 40%");
    expect(buildImageInstructions(base)).toContain("waist or knees up");
  });

  it("panorama não reserva zona e editar não sorteia estilo", () => {
    expect(buildImageInstructions({ ...base, aspectRatio: "21:9" })).not.toContain("TEXT AREA");
    const edit = buildImageInstructions({ ...base, editing: true, style: "editorial", hasFaces: true });
    expect(edit).not.toContain("STYLE");
    expect(edit).toContain("SAME person");
  });
});

describe("overlayForZone", () => {
  it("só põe sombra quando o slide está sem", () => {
    expect(overlayForZone("inferior", "nenhuma")).toBe("base");
    expect(overlayForZone("esquerda", "nenhuma")).toBe("total");
    expect(overlayForZone("inferior", "forte")).toBeNull();
    expect(overlayForZone("nenhuma", "nenhuma")).toBeNull();
  });
});

describe("recorte", () => {
  it("pede fundo branco liso, sem zona nem variação", () => {
    const text = buildImageInstructions({ prompt: "uma ampulheta", aspectRatio: "4:5", hasFaces: false, hasReferences: false, editing: false, style: "recorte", variation: ["x"] });
    expect(text).toContain("PURE WHITE");
    expect(text).not.toContain("TEXT AREA");
    expect(text).not.toContain("LOOK");
    expect(text).not.toContain("never a flat");
  });
});

describe("cotidiano brasileiro", () => {
  it("pede Brasil de verdade e só usa o enquadramento sorteado", () => {
    const text = buildImageInstructions({
      prompt: "pia cheia de louça",
      aspectRatio: "3:2",
      hasFaces: false,
      hasReferences: false,
      editing: false,
      style: "rua",
      variation: ["warm golden-hour light with long soft shadows", "close-up detail shot with shallow depth of field", "blurred city background"],
    });
    expect(text).toContain("Brazil");
    expect(text).toContain("NOT cinematic");
    expect(text).toContain("LOOK (unless the user's description says otherwise): close-up detail shot.");
    expect(text).not.toContain("golden-hour light with long");
    expect(text).not.toContain("blurred city");
  });
});
