import { describe, expect, it } from "vitest";
import { DEFAULT_FEED_STYLE } from "./feed";
import { addMinutes, buildPreset, parseChatMessages, renderFreeSlide } from "./free";

const render = (id: string, body = "") =>
  renderFreeSlide({
    free: buildPreset(id, { title: "", body, hasImage: false }),
    image: null,
    brand: { name: "Dra. Bruna", handle: "drabruna", logo: null },
    palette: DEFAULT_FEED_STYLE.palette,
    titleFont: "sans",
    width: 1080,
    height: 1350,
    index: 0,
    total: 5,
    fontCss: "",
  });

describe("Print de conversa", () => {
  it("separa mensagens e respostas com Eu:", () => {
    expect(parseChatMessages("Oi\nEu: tudo bem?\n\n eu:  sim ")).toEqual([
      { mine: false, text: "Oi" },
      { mine: true, text: "tudo bem?" },
      { mine: true, text: "sim" },
    ]);
  });

  it("anda o relógio e vira a meia-noite", () => {
    expect(addMinutes("21:14", 1)).toBe("21:15");
    expect(addMinutes("23:59", 2)).toBe("00:01");
  });

  it("monta balões com o contato do kit e escapa HTML", () => {
    const html = render("capa-conversa", "<b>oi</b>\nEu: Resposta");
    expect(html).toContain("Dra. Bruna");
    expect(html).toContain("bub them");
    expect(html).toContain("bub me");
    expect(html).not.toContain("<b>oi</b>");
  });

  it("notificações com relógio e idades crescentes", () => {
    const html = render("capa-notificacoes");
    expect(html).toContain("09:41");
    expect(html).toContain("agora");
    expect(html).toContain("2 min");
  });
});
