import { describe, expect, it } from "vitest";
import { anteriorDoMeta, somarInsights, trafegoEfetivo, trafegoDoMeta } from "./meta";

const conta1 = {
  spend: "1000.50",
  impressions: "100000",
  clicks: "2000",
  actions: [
    { action_type: "lead", value: "40" },
    { action_type: "offsite_conversion.fb_pixel_lead", value: "40" }, // repetido: não soma duas vezes
    { action_type: "purchase", value: "10" },
    { action_type: "video_view", value: "50000" },
  ],
  action_values: [{ action_type: "purchase", value: "5000" }],
};
const conta2 = { spend: "500", impressions: "50000", clicks: "500", actions: [{ action_type: "omni_purchase", value: "5" }], action_values: [{ action_type: "omni_purchase", value: "2500" }] };

describe("Meta Ads", () => {
  it("soma as contas sem contar a mesma conversão duas vezes", () => {
    expect(somarInsights([conta1, conta2])).toEqual({
      investimento: 1500.5,
      impressoes: 150000,
      cliques: 2500,
      leads: 40,
      vendas: 15,
      faturamento: 7500,
      visualizacoes: 50000,
    });
  });

  it("calcula as taxas", () => {
    const t = trafegoDoMeta(somarInsights([conta1]));
    expect(t).toMatchObject({ investimento: 1000.5, ctr: 2, cpc: 0.5, cpm: 10.01, cpv: 0.02, leads: 40, vendas: 10, faturamento: 5000 });
    expect(trafegoDoMeta(somarInsights([]))).toEqual({});
  });

  it("o que a equipe digita vale mais, e CPL e ROAS se recalculam", () => {
    const dados = { meta_ads: { atual: somarInsights([conta1]), anterior: somarInsights([conta2]), contas: ["act_1"], em: "" } };
    const t = trafegoEfetivo(dados, { vendas: 12, faturamento: 6000.5, observacao: "Vendas da Hotmart" });
    expect(t.vendas).toBe(12);
    expect(t.roas).toBe(6);
    expect(t.cpl).toBe(25.01);
    expect(t.observacao).toBe("Vendas da Hotmart");
    expect(trafegoEfetivo({ meta_ads: null }, { investimento: 10 })).toEqual({ investimento: 10 });
  });

  it("comparação só para o que veio do Meta", () => {
    const dados = { meta_ads: { atual: somarInsights([conta1]), anterior: somarInsights([conta2]), contas: ["act_1"], em: "" } };
    expect(anteriorDoMeta(dados, {}, "investimento")).toBe(500);
    expect(anteriorDoMeta(dados, { vendas: 3 }, "vendas")).toBeNull();
  });
});
