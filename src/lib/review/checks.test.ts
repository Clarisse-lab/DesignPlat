import { describe, expect, it } from "vitest";
import type { FreeSlide } from "../templates/free";
import { staticChecks } from "./checks";

const free = (elements: FreeSlide["elements"], bg: FreeSlide["bg"] = "fundo"): FreeSlide => ({ bg, overlay: "nenhuma", elements });
const slide = (f: FreeSlide, image: string | null = null) => ({ layout: "livre", title: "", body: "", image, free: f });

describe("revisão sem renderizar", () => {
  it("acusa foto faltando, destaque aberto, texto de exemplo e @ de outra pessoa", () => {
    const msgs = staticChecks({
      slides: [
        slide(free([], "foto")),
        slide(free([{ id: "a", kind: "imagem", x: 0, y: 0, w: 50, h: 50 }, { id: "b", kind: "texto", x: 0, y: 0, w: 50, text: "siga @outra e **abre" }])),
        slide(free([{ id: "c", kind: "titulo", x: 0, y: 0, w: 50, text: "Lorem ipsum" }])),
      ],
      handle: "@cliente",
      legenda: null,
    }).map((x) => x.msg);
    expect(msgs).toEqual([
      "Fundo de foto sem foto (a tela sai preta).",
      "Espaço de foto vazio.",
      "Destaque (**) aberto e não fechado: aparece um ** no texto.",
      "@outra escrito na tela, mas o cliente é @cliente.",
      "Texto de exemplo esquecido na tela.",
    ]);
  });

  it("legenda: chamada para ação, tamanho e hashtags", () => {
    const check = (legenda: string) => staticChecks({ slides: [], handle: "x", legenda }).map((x) => x.msg);
    expect(check("Texto sem chamada #a")).toHaveLength(1);
    expect(check("Gostou? Comente BALA que eu te mando o link.")).toEqual([]);
    expect(check(`${"a".repeat(2300)} salva`)[0]).toContain("2200");
    expect(check(`Salva! ${Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ")}`)[0]).toContain("31 hashtags");
  });
});
