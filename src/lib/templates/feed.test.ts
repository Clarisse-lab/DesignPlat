import { describe, expect, it } from "vitest";
import {
  columnBlocks,
  DEFAULT_FEED_STYLE,
  listItems,
  renderFeedSlide,
  resolveFeedStyle,
  sectionNumberAt,
  splitContentIntoSlides,
  type FeedStyle,
} from "./feed";
import { contrastText, safeColor } from "./utils";

const brand = { name: "Mantora Lab", handle: "@mantoralab", logo: null };
const style: FeedStyle = DEFAULT_FEED_STYLE;

describe("splitContentIntoSlides", () => {
  it("separa por linha em branco, usando a primeira linha como título", () => {
    const slides = splitContentIntoSlides("# Capa\nSubtítulo\n\nPonto 1\nExplicação\nmais texto");
    expect(slides).toHaveLength(2);
    expect(slides[0]).toMatchObject({ layout: "destaque", title: "Capa", body: "Subtítulo" });
    expect(slides[1]).toMatchObject({ layout: "texto", title: "Ponto 1", body: "Explicação\nmais texto" });
  });

  it("usa --- como separador quando presente, mantendo parágrafos no mesmo slide", () => {
    const slides = splitContentIntoSlides("Título A\n\nParágrafo 1\n\nParágrafo 2\n---\nTítulo B");
    expect(slides).toHaveLength(2);
    expect(slides[0].body).toBe("Parágrafo 1\n\nParágrafo 2");
  });

  it("devolve lista vazia para texto vazio", () => {
    expect(splitContentIntoSlides("   \n ")).toEqual([]);
  });
});

describe("renderFeedSlide", () => {
  it("mostra a numeração e o @ da marca", () => {
    const html = renderFeedSlide({ slide: { layout: "texto", title: "Oi", body: "**forte**" }, brand, style, index: 1, total: 3, fontCss: "" });
    expect(html).toContain("2/3");
    expect(html).toContain("@mantoralab");
    expect(html).toContain("<strong>forte</strong>");
  });

  it("ignora cores fora do formato #RRGGBB", () => {
    const evil = { ...style, palette: { background: "red;}</style><script>", text: "#000000", accent: "#4F46E5" } };
    const html = renderFeedSlide({ slide: { layout: "texto", title: "x", body: "" }, brand, style: evil, index: 0, total: 1, fontCss: "" });
    expect(html).not.toContain("<script>");
  });
});

describe("cores", () => {
  it("escolhe texto legível sobre o fundo", () => {
    expect(contrastText("#FFFFFF")).toBe("#111111");
    expect(contrastText("#4F46E5")).toBe("#FFFFFF");
    expect(safeColor("blue", "#000000")).toBe("#000000");
  });
});

describe("novos layouts", () => {
  const base = { brand, index: 0, total: 1, fontCss: "" };

  it("lista remove marcadores e numera os itens", () => {
    expect(listItems("- um\n• dois\n3. três\n\n")).toEqual(["um", "dois", "três"]);
    const html = renderFeedSlide({ ...base, style, slide: { layout: "lista", title: "Passos", body: "- um\n- dois" } });
    expect(html).toContain(">01<");
    expect(html).toContain(">02<");
  });

  it("antes × depois cria duas colunas a partir de blocos separados por linha em branco", () => {
    const html = renderFeedSlide({
      ...base,
      style,
      slide: { layout: "comparacao", title: "", body: "Antes\n- caos\n\nDepois\n- ordem" },
    });
    expect(html).toContain('class="col before"');
    expect(html).toContain('class="col after"');
  });

  it("aplica alinhamento, decoração e fonte de título", () => {
    const custom = resolveFeedStyle({ align: "center", verticalAlign: "bottom", decor: "formas", titleFont: "display" });
    const html = renderFeedSlide({ ...base, style: custom, slide: { layout: "texto", title: "Oi", body: "x", icon: "foguete" } });
    expect(html).toContain("text-align:center");
    expect(html).toContain("justify-content:flex-end");
    expect(html).toContain('class="shape s1"');
    expect(html).toContain("Bebas Neue");
    expect(html).toContain("<svg");
  });

  it("layout da referência limpa o HTML da IA e preenche os campos do slide", () => {
    const custom = resolveFeedStyle({
      customLayout: {
        name: "teste",
        html: '<div class="t" onclick="alert(1)">{{title}}</div><script>alert(1)</script><img src="https://evil.example/x.png">',
        css: '.t{color:var(--accent);background:url(https://evil.example/bg.png)} @import url("https://evil.example/a.css");',
      },
    });
    const html = renderFeedSlide({ ...base, style: custom, slide: { layout: "referencia", title: "<b>Oi</b>", body: "" } });
    expect(html).toContain("&lt;b&gt;Oi&lt;/b&gt;");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("evil.example");
  });

  it("sem layout da referência, cai no layout Texto", () => {
    const html = renderFeedSlide({ ...base, style, slide: { layout: "referencia", title: "Oi", body: "" } });
    expect(html).toContain('class="bar"');
  });

  it("Destaque pode usar o fundo normal em vez da cor de destaque", () => {
    const plain = resolveFeedStyle({ coverBackground: "background" });
    const html = renderFeedSlide({ ...base, style: plain, slide: { layout: "destaque", title: "Oi", body: "" } });
    expect(html).toContain(`background:${plain.palette.background}`);
    expect(renderFeedSlide({ ...base, style, slide: { layout: "destaque", title: "Oi", body: "" } })).toContain(`background:${style.palette.accent}`);
  });

  it("completa estilos antigos com os valores padrão", () => {
    const old = resolveFeedStyle({ titleFont: "serif", titleScale: 9 } as Partial<FeedStyle>);
    expect(old.align).toBe("left");
    expect(old.titleScale).toBe(1.4);
  });
});

describe("Story 9:16", () => {
  const story: FeedStyle = { ...DEFAULT_FEED_STYLE, size: "story-9x16" };
  const base = { brand, style: story, index: 0, total: 1, fontCss: "" };

  it("usa 1080×1920 e afasta o conteúdo das faixas cobertas pelo Instagram", () => {
    const html = renderFeedSlide({ ...base, slide: { layout: "texto", title: "Oi", body: "" } });
    expect(html).toContain("width:1080px;height:1920px");
    // 13% de 1920 no topo e 17% na base
    expect(html).toContain("padding:250px");
    expect(html).toContain("326px");
  });

  it("deixa o espaço do sticker vazio no layout de enquete", () => {
    const html = renderFeedSlide({ ...base, slide: { layout: "sticker", title: "Qual tema?", body: "" } });
    expect(html).toContain('class="sticker-slot"');
    expect(html).toContain("Qual tema?");
  });

  it("mostra o botão de link com texto padrão quando o corpo está vazio", () => {
    expect(renderFeedSlide({ ...base, slide: { layout: "cta", title: "Blog", body: "" } })).toContain("Toque no link");
    const html = renderFeedSlide({ ...base, slide: { layout: "cta", title: "Blog", body: "Leia agora" } });
    expect(html).toContain('class="cta-btn"');
    expect(html).toContain("Leia agora");
  });

  it("mantém o padding normal no feed", () => {
    const html = renderFeedSlide({ ...base, style: DEFAULT_FEED_STYLE, slide: { layout: "texto", title: "Oi", body: "" } });
    expect(html).not.toContain("padding:250px");
  });
});

describe("Apresentação 16:9", () => {
  const deck: FeedStyle = { ...DEFAULT_FEED_STYLE, size: "slide-16x9" };
  const base = { brand, style: deck, index: 0, total: 1, fontCss: "" };

  it("usa 1920×1080 com margens laterais maiores", () => {
    const html = renderFeedSlide({ ...base, slide: { layout: "texto", title: "Oi", body: "" } });
    expect(html).toContain("width:1920px;height:1080px");
    expect(html).toContain("padding:88px 140px 72px 140px");
  });

  it("coloca a foto ao lado do texto no layout Foto", () => {
    const html = renderFeedSlide({ ...base, slide: { layout: "foto", title: "Oi", body: "" } });
    expect(html).toContain('class="photo side"');
    expect(html).toContain("padding:88px 140px 72px 993px");
  });

  it("divide listas longas em duas colunas", () => {
    const html = renderFeedSlide({ ...base, slide: { layout: "lista", title: "x", body: "a\nb\nc\nd\ne\nf" } });
    expect(html).toContain('class="list two"');
  });

  it("numera as seções e monta as colunas", () => {
    const slides = [{ layout: "secao" as const }, { layout: "texto" as const }, { layout: "secao" as const }];
    expect(sectionNumberAt(slides, 2)).toBe(2);
    expect(renderFeedSlide({ ...base, sectionNumber: 2, slide: { layout: "secao", title: "Parte", body: "" } })).toContain(">02<");

    expect(columnBlocks("Educar\nEnsina algo\n\nVender\n\nInspirar\nHistórias")).toEqual([
      { label: "Educar", text: "Ensina algo" },
      { label: "Vender", text: "" },
      { label: "Inspirar", text: "Histórias" },
    ]);
    const html = renderFeedSlide({ ...base, slide: { layout: "colunas", title: "Pilares", body: "A\nx\n\nB\ny" } });
    expect(html).toContain("grid-template-columns:repeat(2,1fr)");
    expect(html.match(/class="card"/g)).toHaveLength(2);
  });
});
