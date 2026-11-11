import { describe, expect, it } from "vitest";
import { buildPreset, fillTemplate, layoutSignature, stripTemplate, templateInfo } from "./free";

const dividida = () =>
  stripTemplate(buildPreset("doc-dividida", { title: "Folga é pra deitar", body: "Folga é o dia que eu decido", hasImage: true }, { placeholders: false }));

describe("telas salvas como estilo", () => {
  it("guarda o desenho sem as fotos e mede o texto do modelo", () => {
    const tpl = dividida();
    expect(tpl.elements.find((e) => e.kind === "grade")?.images).toEqual([]);
    expect(templateInfo(tpl)).toEqual({ titleChars: 18, bodyChars: 27, blocks: [{ chars: 27, list: false }], hasTag: false, photos: 2 });
  });

  it("troca título e texto, encolhe título longo e mantém o @", () => {
    const tpl = dividida();
    const out = fillTemplate(tpl, { title: "Uma frase bem mais longa que a original, para a fonte encolher", body: "Outra", hasImage: true });
    const title = out.elements.find((e) => e.kind === "titulo")!;
    expect(title.text).toContain("bem mais longa");
    expect(title.size!).toBeLessThan(tpl.elements.find((e) => e.kind === "titulo")!.size!);
    expect(out.elements.some((e) => e.text === "{usuario}")).toBe(true);
  });

  it("sem texto de apoio, o texto sai; sem foto, o fundo de foto vira cor", () => {
    expect(fillTemplate(dividida(), { title: "x", body: "", hasImage: false }).elements.map((e) => e.kind)).toEqual(["grade", "titulo", "texto"]);
    const capa = stripTemplate(buildPreset("doc-capa", { title: "Folga na bala", body: "UM DIA", hasImage: true }, { placeholders: false }));
    expect(fillTemplate(capa, { title: "T", body: "", hasImage: false }).bg).toBe("fundo");
  });

  it("texto em blocos: um pedaço por bloco, rodapé pequeno fica fixo", () => {
    const e = (kind: "titulo" | "texto", y: number, text: string, size: number) => ({ id: `${kind}-${y}`, kind, x: 3, y, w: 90, size, text });
    const tpl = {
      bg: "fundo" as const,
      overlay: "nenhuma" as const,
      elements: [e("texto", 2, "Powered by Content Machine", 20), e("titulo", 7, "O Instagram **mudou**", 66), e("texto", 25, "Parágrafo de exemplo.", 54), e("texto", 75, "→ um\n→ dois\n→ três", 34)],
    };
    expect(templateInfo(tpl).blocks).toEqual([{ chars: 21, list: false }, { chars: 18, list: true }]);
    const out = fillTemplate(tpl, { title: "Novo", body: "Primeiro bloco.\n\n→ a\n→ b", hasImage: false });
    expect(out.elements.map((x) => x.text)).toEqual(["Powered by Content Machine", "Novo", "Primeiro bloco.", "→ a\n→ b"]);
  });

  it("mesmo desenho, mesma assinatura", () => {
    const other = stripTemplate(buildPreset("doc-dividida", { title: "a", body: "b", hasImage: true }, { placeholders: false }));
    expect(layoutSignature(dividida())).toBe(layoutSignature(other));
  });
});
