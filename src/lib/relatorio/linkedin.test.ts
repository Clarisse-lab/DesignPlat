import { describe, expect, it } from "vitest";
import { linkDoPost, linkedinDoPeriodo, seguidoresAte, somaCampo, type DiaLinkedin } from "./linkedin";

const dia = (fonte_urn: string, data: string, extra: Partial<DiaLinkedin> = {}): DiaLinkedin => ({
  fonte_urn,
  data,
  impressoes: null,
  reacoes: null,
  comentarios: null,
  compartilhamentos: null,
  cliques: null,
  novos_seguidores: null,
  seguidores: null,
  visualizacoes_pagina: null,
  ...extra,
});

const PAG = "urn:li:organization:1";
const PER = "urn:li:person:abc";

describe("LinkedIn no relatório", () => {
  const dias: DiaLinkedin[] = [
    // semana anterior
    dia(PAG, "2026-11-10", { impressoes: 100, reacoes: 4, comentarios: 1, compartilhamentos: 0, cliques: 5, novos_seguidores: 2 }),
    // semana do relatório (16 a 22)
    dia(PAG, "2026-11-16", { impressoes: 300, reacoes: 10, comentarios: 2, compartilhamentos: 1, cliques: 7, novos_seguidores: 3, visualizacoes_pagina: 20 }),
    dia(PAG, "2026-11-18", { impressoes: 200, reacoes: 5, comentarios: 0, compartilhamentos: 0, cliques: 0, novos_seguidores: 1 }),
    dia(PER, "2026-11-17", { impressoes: 500, reacoes: 20 }),
    // leituras de seguidores
    dia(PAG, "2026-11-20", { seguidores: 1200 }),
    dia(PAG, "2026-11-23", { seguidores: 1210 }),
    dia(PER, "2026-11-23", { seguidores: 4000 }),
  ];

  it("soma só o intervalo e devolve null quando não há o campo", () => {
    expect(somaCampo(dias, "impressoes", "2026-11-16", "2026-11-22")).toBe(1000);
    expect(somaCampo(dias, "visualizacoes_pagina", "2026-11-09", "2026-11-15")).toBeNull();
  });

  it("seguidores: a última leitura de cada fonte até o dia", () => {
    expect(seguidoresAte(dias, "2026-11-22")).toBe(1200);
    expect(seguidoresAte(dias, "2026-11-23")).toBe(5210);
    expect(seguidoresAte(dias, "2026-11-01")).toBeNull();
  });

  it("período com comparação, engajamento e posts do período", () => {
    const r = linkedinDoPeriodo({
      fontes: [
        { urn: PAG, nome: "Paycon", tipo: "pagina" },
        { urn: PER, nome: "Thiago", tipo: "perfil" },
      ],
      dias,
      posts: [
        { post_urn: "urn:li:share:1", publicado_em: "2026-11-17T12:00:00Z", texto: "A", impressoes: 90, reacoes: 3, comentarios: 1, compartilhamentos: 0, cliques: 2 },
        { post_urn: "urn:li:share:2", publicado_em: "2026-11-19T12:00:00Z", texto: "B", impressoes: 150, reacoes: 5, comentarios: 0, compartilhamentos: 1, cliques: 0 },
        { post_urn: "urn:li:share:3", publicado_em: "2026-11-01T12:00:00Z", texto: "fora", impressoes: 999, reacoes: 0, comentarios: 0, compartilhamentos: 0, cliques: 0 },
      ],
      periodo: { inicio: "2026-11-16", fim: "2026-11-22" },
      anterior: { inicio: "2026-11-09", fim: "2026-11-15" },
      leituraAte: "2026-11-23",
    })!;
    expect(r.impressoes).toEqual({ valor: 1000, anterior: 100 });
    expect(r.novos_seguidores).toEqual({ valor: 4, anterior: 2 });
    expect(r.seguidores).toBe(5210);
    // (35 reações + 2 comentários + 1 compartilhamento + 7 cliques) / 1000 impressões
    expect(r.engajamento.valor).toBe(4.5);
    expect(r.engajamento.anterior).toBe(10);
    expect(r.visualizacoes_pagina?.valor).toBe(20);
    expect(r.posts.map((p) => p.texto)).toEqual(["B", "A"]);
    expect(r.posts[0].interacoes).toBe(6);
    expect(r.ate).toBe("2026-11-18");
  });

  it("sem números no período, a seção some; só perfil não tem cliques nem visitas", () => {
    expect(
      linkedinDoPeriodo({ fontes: [{ urn: PAG, nome: "P", tipo: "pagina" }], dias, posts: [], periodo: { inicio: "2026-10-01", fim: "2026-10-07" }, anterior: { inicio: "2026-09-24", fim: "2026-09-30" }, leituraAte: "2026-10-08" }),
    ).toBeNull();
    const so = linkedinDoPeriodo({
      fontes: [{ urn: PER, nome: "T", tipo: "perfil" }],
      dias: dias.filter((d) => d.fonte_urn === PER),
      posts: [],
      periodo: { inicio: "2026-11-16", fim: "2026-11-22" },
      anterior: { inicio: "2026-11-09", fim: "2026-11-15" },
      leituraAte: "2026-11-23",
    })!;
    expect(so.cliques).toBeNull();
    expect(so.impressoes).toEqual({ valor: 500, anterior: null });
  });

  it("link público do post", () => {
    expect(linkDoPost("urn:li:share:7")).toBe("https://www.linkedin.com/feed/update/urn:li:share:7/");
  });
});
