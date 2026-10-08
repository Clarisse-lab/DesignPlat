import { describe, expect, it } from "vitest";
import { renderTweetSlide, tweetFontSize } from "./tweet";
import { formatRichText, safeImageSrc } from "./utils";

const profile = { name: "Maria Silva", handle: "@maria", verified: true };
const style = { theme: "light" as const, size: "portrait-3x4" as const };

describe("formatRichText", () => {
  it("escapa HTML, aplica negrito e preserva quebras de linha", () => {
    expect(formatRichText("<b>oi</b>\n**forte** & fim")).toBe("&lt;b&gt;oi&lt;/b&gt;<br/><strong>forte</strong> &amp; fim");
  });
});

describe("safeImageSrc", () => {
  it("aceita data URLs de imagem", () => {
    expect(safeImageSrc("data:image/png;base64,iVBORw0KGgo=")).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("rejeita URLs externas e valores com aspas", () => {
    expect(safeImageSrc("https://example.com/a.png")).toBeNull();
    expect(safeImageSrc('data:image/png;base64,AAA" onerror="x')).toBeNull();
    expect(safeImageSrc("data:text/html;base64,AAAA")).toBeNull();
  });
});

describe("renderTweetSlide", () => {
  it("monta o card com nome, handle sem @ duplicado e iniciais sem avatar", () => {
    const html = renderTweetSlide({ slide: { text: "Olá **mundo**" }, profile, style, fontCss: "" });
    expect(html).toContain("width:1080px;height:1440px");
    expect(html).toContain("@maria<");
    expect(html).not.toContain("@@maria");
    expect(html).toContain(">MS<");
    expect(html).toContain("<strong>mundo</strong>");
    expect(html).toContain('class="badge"');
  });

  it("ignora imagem que não é data URL", () => {
    const html = renderTweetSlide({
      slide: { text: "x", image: "https://evil.example/x.png" },
      profile,
      style,
      fontCss: "",
    });
    expect(html).not.toContain("evil.example");
  });
});

describe("tweetFontSize", () => {
  it("diminui a fonte conforme o texto cresce", () => {
    expect(tweetFontSize("curto", false)).toBeGreaterThan(tweetFontSize("x".repeat(300), false));
    expect(tweetFontSize("curto", true)).toBeLessThan(tweetFontSize("curto", false));
  });
});
