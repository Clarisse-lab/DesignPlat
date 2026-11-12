import { describe, expect, it } from "vitest";
import {
  acimaAbaixo,
  alcancePorPeriodo,
  coletaDaSemana,
  fimDoMes,
  historico,
  inicioValido,
  intervaloUtc,
  marcos,
  melhores,
  mesesRecentes,
  novosSeguidores,
  periodoAnterior,
  segunda,
  semanasRecentes,
  totais,
  ultimaSemanaCompleta,
  ultimoMesCompleto,
  variacao,
} from "./calc";
import type { PostSemana } from "./tipos";

const post = (id: string, alcance: number | null, salvos = 0, compart = 0): PostSemana => ({
  media_id: id,
  publicado_em: "2026-11-03T12:00:00Z",
  formato: "Carrossel",
  legenda: "",
  permalink: null,
  alcance,
  interacoes: alcance === null ? null : Math.round(alcance / 10),
  salvamentos: salvos,
  compartilhamentos: compart,
  visualizacoes: null,
  capa: null,
});

describe("semanas", () => {
  it("acha a segunda-feira", () => {
    expect(segunda("2026-11-11")).toBe("2026-11-09");
    expect(segunda("2026-11-09")).toBe("2026-11-09");
    expect(segunda("2026-11-15")).toBe("2026-11-09"); // domingo
  });

  it("última semana completa no horário de Brasília", () => {
    expect(ultimaSemanaCompleta(new Date("2026-11-11T21:00:00Z"))).toEqual({ inicio: "2026-11-02", fim: "2026-11-08" });
    // Segunda 01h em Brasília ainda é domingo 23h? Não: 2026-11-09T03:30Z = segunda 00h30 em Brasília.
    expect(ultimaSemanaCompleta(new Date("2026-11-09T03:30:00Z"))).toEqual({ inicio: "2026-11-02", fim: "2026-11-08" });
    // Domingo 23h em Brasília (segunda 02h UTC): a semana ainda não fechou.
    expect(ultimaSemanaCompleta(new Date("2026-11-09T02:00:00Z"))).toEqual({ inicio: "2026-10-26", fim: "2026-11-01" });
  });

  it("lista as semanas recentes", () => {
    expect(semanasRecentes(2, new Date("2026-11-11T21:00:00Z"))).toEqual([
      { inicio: "2026-11-02", fim: "2026-11-08" },
      { inicio: "2026-10-26", fim: "2026-11-01" },
    ]);
  });

  it("intervalo em UTC cobre a semana em Brasília", () => {
    expect(intervaloUtc("2026-11-02")).toEqual({ de: "2026-11-02T03:00:00.000Z", ate: "2026-11-09T03:00:00.000Z" });
  });
});

describe("coletas e seguidores", () => {
  it("usa a primeira coleta depois do domingo", () => {
    expect(coletaDaSemana("2026-11-08", ["2026-11-03", "2026-11-09"])).toEqual({ data: "2026-11-09", parcial: false });
    expect(coletaDaSemana("2026-11-01", ["2026-11-03", "2026-11-09"])).toEqual({ data: "2026-11-03", parcial: false });
    expect(coletaDaSemana("2026-11-15", ["2026-11-03", "2026-11-09"])).toEqual({ data: "2026-11-09", parcial: true });
  });

  it("novos seguidores entre as coletas das segundas", () => {
    const pontos = [
      { conta: "a", data: "2026-11-03", seguidores: 954046 },
      { conta: "a", data: "2026-11-09", seguidores: 958024 },
    ];
    expect(novosSeguidores(pontos, "2026-11-02", "2026-11-08")).toBe(3978);
    expect(novosSeguidores(pontos, "2026-10-26", "2026-11-01")).toBeNull();
  });
});

describe("totais e melhores", () => {
  it("soma e compara", () => {
    const t = totais([post("1", 1000, 10, 5), post("2", 500, 2, 1), post("3", null)]);
    expect(t).toMatchObject({ posts: 3, alcance: 1500, salvos_compart: 18 });
    expect(variacao({ valor: 1500, anterior: 1000 })).toBe(50);
    expect(variacao({ valor: 1500, anterior: null })).toBeNull();
  });

  it("escolhe pelos dois sinais (alcance e nota)", () => {
    const lista = [post("grande", 10000, 10), post("guardado", 2000, 200), post("fraco", 300, 1), post("medio", 5000, 50)];
    expect(melhores(lista)).toEqual(["guardado", "grande", "medio"]);
  });
});

describe("meses", () => {
  it("último mês completo e os anteriores", () => {
    expect(ultimoMesCompleto(new Date("2026-11-11T21:00:00Z"))).toEqual({ inicio: "2026-10-01", fim: "2026-10-31" });
    // 1º de novembro 01h em Brasília ainda é outubro? Não: 2026-11-01T02:00Z = 31/10 23h em Brasília, então setembro é o último completo.
    expect(ultimoMesCompleto(new Date("2026-11-01T02:00:00Z"))).toEqual({ inicio: "2026-09-01", fim: "2026-09-30" });
    expect(mesesRecentes(3, new Date("2026-03-05T12:00:00Z")).map((m) => m.inicio)).toEqual(["2026-02-01", "2026-01-01", "2025-12-01"]);
    expect(fimDoMes("2028-02-01")).toBe("2028-02-29");
  });

  it("período anterior, início válido e intervalo do mês", () => {
    expect(periodoAnterior("mes", "2026-10-01")).toEqual({ inicio: "2026-09-01", fim: "2026-09-30" });
    expect(periodoAnterior("semana", "2026-11-02")).toEqual({ inicio: "2026-10-26", fim: "2026-11-01" });
    expect(inicioValido("mes", "2026-10-01")).toBe(true);
    expect(inicioValido("mes", "2026-10-02")).toBe(false);
    expect(inicioValido("semana", "2026-11-02")).toBe(true);
    expect(intervaloUtc("2026-10-01", "2026-10-31")).toEqual({ de: "2026-10-01T03:00:00.000Z", ate: "2026-11-01T03:00:00.000Z" });
  });
});

describe("normal do perfil e momentos", () => {
  const base = Array.from({ length: 20 }, (_, i) => ({ ...post(`b${i}`, 10000 + i * 100, 50, 50), publicado_em: `2026-10-${String(i + 1).padStart(2, "0")}T12:00:00Z` }));

  it("mediana do histórico e posts acima e abaixo", () => {
    const h = historico(base, "2026-10-01")!;
    expect(h.posts).toBe(20);
    expect(h.mediana_alcance).toBe(10950);
    expect(h.mediana_salvos_compart).toBe(100);
    const r = acimaAbaixo([post("alto", 40000), post("ok", 11000), post("baixo", 3000)], h);
    expect(r).toEqual({ acima: ["alto"], abaixo: ["baixo"] });
    expect(historico(base.slice(0, 3), "2026-10-01")).toBeNull();
  });

  it("recorde de post, recorde de período e conteúdo guardado", () => {
    const h = historico(base, "2026-10-01");
    const lista = [post("viral", 120000, 900, 2100), post("normal", 9000, 40, 40)];
    const m = marcos({
      tipo: "semana",
      lista,
      base,
      historico: h,
      anteriores: [
        { inicio: "2026-10-26", alcance: 50000 },
        { inicio: "2026-10-19", alcance: 60000 },
        { inicio: "2026-10-12", alcance: 70000 },
      ],
      novos_seguidores: 2500,
    });
    expect(m[0].titulo).toBe("Seu post mais visto desde 01/10");
    expect(m[0].media_id).toBe("viral");
    expect(m[1].titulo).toBe("A semana de maior alcance desde 12/10");
    expect(m.some((x) => x.titulo.startsWith("Novos seguidores"))).toBe(true);
    expect(m.length <= 4).toBe(true);
  });

  it("alcance por período usa a data de publicação", () => {
    const a = alcancePorPeriodo("semana", [{ ...post("x", 500), publicado_em: "2026-10-27T15:00:00Z" }, { ...post("y", 300), publicado_em: "2026-10-20T15:00:00Z" }], "2026-11-02", 4);
    expect(a).toEqual([
      { inicio: "2026-10-26", alcance: 500 },
      { inicio: "2026-10-19", alcance: 300 },
    ]);
  });
  it("post recente não entra em abaixo do normal", () => {
    const base = Array.from({ length: 6 }, (_, i) => post(`b${i}`, 1000));
    const h = historico(base, "2026-10-01")!;
    const lista = [
      { ...post("velho", 100), publicado_em: "2026-11-03T15:00:00Z" },
      { ...post("novo", 100), publicado_em: "2026-11-08T15:00:00Z" },
    ];
    expect(acimaAbaixo(lista, h, "2026-11-09").abaixo).toEqual(["velho"]);
    expect(acimaAbaixo(lista, h).abaixo.length).toBe(2);
  });

  it("momentos do mês concordam no masculino", () => {
    const base = Array.from({ length: 6 }, (_, i) => post(`b${i}`, 1000));
    const h = historico(base, "2026-07-01")!;
    const m = marcos({
      tipo: "mes",
      lista: [post("a", 5000), post("b", 4000)],
      base,
      historico: h,
      anteriores: [
        { inicio: "2026-09-01", alcance: 3000 },
        { inicio: "2026-08-01", alcance: 2000 },
        { inicio: "2026-07-01", alcance: 1000 },
      ],
      novos_seguidores: 1500,
    });
    expect(m.find((x) => x.titulo.startsWith("O mês de maior alcance"))?.titulo).toBe("O mês de maior alcance desde julho");
    expect(m.some((x) => x.titulo === "Novos seguidores no mês")).toBe(true);
  });
});
