import { describe, expect, it } from "vitest";
import { pecaRequestSchema } from "./schema";

const base = {
  brand: { name: "Sabrina Nascimento", handle: "@sabrina" },
  style: { size: "portrait-4x5", titleFont: "serif" },
  slides: [{ layout: "destaque", title: "Capa", body: "" }],
};

describe("pecaRequestSchema", () => {
  it("aceita estilo parcial e marca sem logo", () => {
    expect(pecaRequestSchema.safeParse(base).success).toBe(true);
  });

  it("recusa layout, formato ou cor inválidos", () => {
    expect(pecaRequestSchema.safeParse({ ...base, slides: [{ layout: "xyz", title: "a", body: "" }] }).success).toBe(false);
    expect(pecaRequestSchema.safeParse({ ...base, style: { size: "a4" } }).success).toBe(false);
    expect(pecaRequestSchema.safeParse({ ...base, style: { palette: { background: "red", text: "#000000", accent: "#000000" } } }).success).toBe(false);
  });

  it("recusa peça sem slides", () => {
    expect(pecaRequestSchema.safeParse({ ...base, slides: [] }).success).toBe(false);
  });
});
