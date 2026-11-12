import { describe, expect, it } from "vitest";
import { categoria, fimDoProximo, producao, quantidade, separarTarefas, type TarefaBruta } from "./trabalho";

// Meia-noite de Brasília do dia, em ms (como o prazo vem do ClickUp).
const ms = (d: string, hora = "03:00") => new Date(`${d}T${hora}:00Z`).getTime();
const t = (nome: string, lista: string, status: string, prazo: string | null, atualizada: string): TarefaBruta => ({
  nome,
  lista,
  status,
  fechada: false,
  prazo: prazo ? ms(prazo) : null,
  atualizada: ms(atualizada, "15:00"),
});

describe("trabalho do ClickUp", () => {
  const semana = { inicio: "2026-11-02", fim: "2026-11-08" };
  const tarefas = [
    t("Bruna Reels | Comunidade", "Bruna - Edição de vídeo ", "finalizado", "2026-11-03", "2026-11-03"),
    t("Bruna Imagem | Histórias", "Bruna - Calendário ", "finalizado", "2026-11-07", "2026-11-09"), // finalizada na segunda: conta pelo prazo
    t("Bruna Reels | Sangramento", "Bruna - Edição de vídeo ", "finalizado", "2026-07-01", "2026-11-04"), // atualização em massa: não conta
    t("Bruna - Design de 05 anúncios", "Bruna - design", "alteração design", "2026-10-06", "2026-10-08"),
    t("Bruna - Design do destaque 07", "Bruna - design", "pendente", "2026-11-13", "2026-11-09"),
    t("Bruna Carrossel | Daqui a um mês", "Bruna - Calendário ", "pendente", "2026-12-10", "2026-11-09"), // longe demais
    t("Bruna - Carrossel | Filme", "Bruna - Calendário ", "stand by", "2026-11-05", "2026-11-09"),
    t("Bruna | Analisar dados", "Bruna- Atividades", "pendente", null, "2026-11-01"),
  ];

  it("separa feito, em andamento e próximo", () => {
    const r = separarTarefas(tarefas, "semana", semana.inicio, semana.fim);
    expect(r.feitas.map((x) => x.nome)).toEqual(["Bruna Reels | Comunidade", "Bruna Imagem | Histórias"]);
    expect(r.andamento.map((x) => x.nome)).toEqual(["Bruna - Design de 05 anúncios"]);
    expect(r.proximas.map((x) => x.nome)).toEqual(["Bruna - Design do destaque 07"]);
  });

  it("no mês, o próximo vai até o fim do mês seguinte", () => {
    expect(fimDoProximo("mes", "2026-10-31")).toBe("2026-11-30");
    expect(fimDoProximo("semana", "2026-11-08")).toBe("2026-11-15");
  });

  it("classifica e conta o que foi produzido", () => {
    expect(categoria({ nome: "Bruna Reels | X", lista: "Bruna - Calendário " })?.chave).toBe("texto");
    expect(categoria({ nome: "Bruna Reels | X", lista: "Bruna - Edição de vídeo " })?.chave).toBe("video");
    expect(categoria({ nome: "Transformar a mensagem em e‑mail convite", lista: "Atividades" })?.chave).toBe("email");
    expect(categoria({ nome: "Hosaka | Analisar fase 2", lista: "Hosaka - Atividades" })).toBeNull();
    expect(quantidade("Bruna - Design de 05 anúncios")).toBe(5);
    expect(quantidade("Remarketing Calculadora | 04")).toBe(1);
    const p = producao([
      { nome: "Design de 05 anúncios", lista: "design", status: "finalizado", prazo: null },
      { nome: "Reels A", lista: "Edição de vídeo", status: "finalizado", prazo: null },
      { nome: "Reels B", lista: "Edição de vídeo", status: "finalizado", prazo: null },
      { nome: "Carrossel C", lista: "design", status: "finalizado", prazo: null },
    ]);
    expect(p).toEqual([
      { rotulo: "anúncios criados", total: 5 },
      { rotulo: "vídeos editados", total: 2 },
      { rotulo: "carrossel criado", total: 1 },
    ]);
  });
});
