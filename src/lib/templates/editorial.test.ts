import { describe, expect, it } from "vitest";
import { editorialFundoAt, editorialItems, readableAccent, renderEditorialSlide } from "./editorial";
import { mapToEditorial, ctaWord, expandEditorial, fromGeneratedEditorial } from "../feed/editorial-map";
import { renderFeedSlide, DEFAULT_FEED_STYLE } from "./feed";
import { contrastRatio } from "./utils";

const brand = { name: "Sabrina Nascimento", handle: "@eusousabrinanascimento", logo: null };
const palette = { background: "#151515", text: "#FBFBFB", accent: "#870A12" };
const base = { brand, palette, tokens: null, width: 1080, height: 1350, fontCss: "" };

describe("Editorial: fundos", () => {
  it("alterna claro e escuro no meio, capa escura, fechamento claro, respiro creme e foto quando há imagem", () => {
    expect(editorialFundoAt("capa-impacto", "auto", 0, 8, false)).toBe("escuro");
    expect(editorialFundoAt("capa-foto", "auto", 0, 8, true)).toBe("foto");
    expect(editorialFundoAt("frase-imagem", "auto", 1, 8, true)).toBe("claro");
    expect(editorialFundoAt("frase-imagem", "auto", 2, 8, false)).toBe("escuro");
    expect(editorialFundoAt("respiro", "auto", 3, 8, false)).toBe("creme");
    expect(editorialFundoAt("cta-comente", "auto", 7, 8, false)).toBe("claro");
    expect(editorialFundoAt("frase-imagem", "foto", 2, 8, false)).toBe("escuro"); // pediu foto sem foto
  });

  it("deixa o destaque legível no fundo escuro e no claro", () => {
    expect(contrastRatio(readableAccent("#870A12", "#151515"), "#151515")).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(readableAccent("#FFD54A", "#F2F1EE"), "#F2F1EE")).toBeGreaterThanOrEqual(3);
  });
});

describe("Editorial: telas", () => {
  it("lê itens com rótulo e sem marcador", () => {
    expect(editorialItems("- Oferta: faz sentido?\n2) Esteira: e depois?\nsem rótulo")).toEqual([
      { label: "Oferta", text: "faz sentido?" },
      { label: "Esteira", text: "e depois?" },
      { label: "", text: "sem rótulo" },
    ]);
  });

  it("monta a faixa do topo com nome, @ e ano, e pinta o destaque", () => {
    const html = renderEditorialSlide({ ...base, ed: { tela: "frase-imagem" }, title: "Meta é o **telhado**.", body: "Apoio.", image: null, index: 1, total: 8 });
    expect(html).toContain("Sabrina Nascimento");
    expect(html).toContain("@eusousabrinanascimento");
    expect(html).toContain(`${new Date().getFullYear()} //`);
    expect(html).toContain("<strong>telhado</strong>");
  });

  it("CTA mostra a palavra em caixa alta e o passo a passo numera os itens", () => {
    const cta = renderEditorialSlide({ ...base, ed: { tela: "cta-comente", palavra: "guia" }, title: "Quer o guia?", body: "e eu te mando", image: null, index: 7, total: 8 });
    expect(cta).toContain(">GUIA<");
    const passo = renderEditorialSlide({ ...base, ed: { tela: "passo" }, title: "Faça assim:", body: "Acesse o site\nCopie o texto\nPeça ajuda", image: null, index: 5, total: 8 });
    expect(passo).toContain("(3)");
    expect(passo).toContain('class="last"');
    expect(passo.toUpperCase()).toContain("PASSO A PASSO");
  });

  it("o layout editorial passa pelo renderFeedSlide", () => {
    const html = renderFeedSlide({ slide: { layout: "editorial", title: "Oi", body: "", editorial: { tela: "respiro" } }, brand, style: DEFAULT_FEED_STYLE, index: 2, total: 5, fontCss: "" });
    expect(html).toContain("Playfair Display");
  });
});

describe("Editorial: do texto da IA para as telas", () => {
  it("capa com foto ou impacto, CTA com a palavra e sem a frase repetida", () => {
    expect(mapToEditorial({ tipo: "capa", titulo: "T", texto: "" }, 0, 8, true).editorial.tela).toBe("capa-foto");
    expect(mapToEditorial({ tipo: "capa", titulo: "T", texto: "" }, 0, 8, false).editorial.tela).toBe("capa-impacto");
    const cta = mapToEditorial({ tipo: "cta", titulo: "Quer o roteiro?", texto: "Comente ROTEIRO e eu te mando. Vale para todos." }, 7, 8, false);
    expect(cta.editorial).toMatchObject({ tela: "cta-comente", palavra: "ROTEIRO" });
    expect(cta.body).toBe("Vale para todos.");
    expect(ctaWord({ tipo: "cta", titulo: "x", texto: "sem palavra", etiqueta: "guia" })).toBe("GUIA");
  });

  it("lista vira passo a passo quando são ações, senão lista com setas", () => {
    expect(mapToEditorial({ tipo: "lista", titulo: "Faça", texto: "Acesse o site\nCopie o README\nPeça a explicação" }, 3, 8, false).editorial.tela).toBe("passo");
    expect(mapToEditorial({ tipo: "lista", titulo: "Tipos", texto: "Oferta: x\nEsteira: y\nOperação: z" }, 3, 8, true).editorial.tela).toBe("imagem-lista");
    expect(mapToEditorial({ tipo: "citacao", titulo: "Frase", texto: "" }, 4, 8, false).editorial.tela).toBe("respiro");
  });
});

describe("Editorial: telas escritas pela IA", () => {
  const raw = (tela: string, extra: Record<string, unknown> = {}) => ({ tela, etiqueta: "", titulo: "T", texto: "A: x\nB: y\nC: z", palavra: "", fonte: "", sinal: "", imagem: "", rosto: false, ...extra }) as Parameters<typeof expandEditorial>[0][number];

  it("desdobra a 'revela' em uma tela por item e guarda a fonte só na primeira", () => {
    const out = expandEditorial([raw("capa-impacto"), raw("revela", { sinal: "nao", fonte: "The Verge" }), raw("cta-comente", { palavra: "guia" })]);
    expect(out.map((s) => s.tela).join(",")).toBe("capa-impacto,revela,revela,revela,cta-comente");
    expect(out.slice(1, 4).map((s) => s.ativo).join(",")).toBe("0,1,2");
    expect(out[1].fonte).toBe("The Verge");
    expect(out[2].fonte).toBe("");
    expect(out[4].palavra).toBe("GUIA");
    expect(out[0].tipo).toBe("capa");
  });

  it("sem foto, a capa com foto vira capa impacto e a foto + texto vira frase", () => {
    expect(fromGeneratedEditorial({ tela: "capa-foto", titulo: "x", texto: "" }, false)?.editorial.tela).toBe("capa-impacto");
    expect(fromGeneratedEditorial({ tela: "foto-texto", titulo: "x", texto: "" }, false)?.editorial.tela).toBe("frase-imagem");
    expect(fromGeneratedEditorial({ tela: "capa-foto", titulo: "x", texto: "" }, true)?.foto).toBe(true);
    expect(fromGeneratedEditorial({ tela: "checklist", titulo: "x", texto: "" }, true)?.foto).toBe(false);
    expect(fromGeneratedEditorial({ tela: "inventada", titulo: "x", texto: "" }, true)).toBeNull();
    expect(fromGeneratedEditorial({ tela: "revela", titulo: "x", texto: "", sinal: "nao", ativo: 2 }, false)?.editorial).toMatchObject({ ativo: 2, sinal: "nao" });
  });

  it("monta as telas novas: item aberto, caixas, aspas, lacunas e conta", () => {
    const r = (tela: string, title: string, body: string, ed: Record<string, unknown> = {}) =>
      renderEditorialSlide({ ...base, ed: { tela: tela as never, ...ed }, title, body, image: null, index: 2, total: 8 });
    const rev = r("revela", "Vale priorizar:", "Palavras: use as do cliente\nDM: algo para encaminhar", { ativo: 1, sinal: "sim" });
    expect(rev).toContain("<h3>DM</h3>");
    expect(rev).toContain('class="off"');
    expect(r("checklist", "Revisar", "Na legenda: descreva").includes('class="box"')).toBe(true);
    expect(r("frase", "Tenho notas espalhadas", "", { etiqueta: "Frase 1" })).toContain("“</span>Tenho");
    expect(r("lacunas", "Frases", "Tenho [situação]")).toContain('<span class="blank">[situação]</span>');
    const eq = r("equacao", "Na nossa leitura", "Caso: conhecido\nPergunta: curiosa\n= Motivo: para assistir");
    expect(eq).toContain("<h3>Motivo</h3>");
    expect(r("frase-imagem", "x", "", { fonte: "Folha" })).toContain("Fonte: Folha");
  });
});
