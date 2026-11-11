import { describe, expect, it } from "vitest";
import { coletaDaSemana, intervaloUtc, melhores, novosSeguidores, segunda, semanasRecentes, totais, ultimaSemanaCompleta, variacao } from "./calc";
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
