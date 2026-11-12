import { describe, expect, it } from "vitest";
import { antesDepoisMelhorou, comentariosCandidatos, contaIgDe, leitura, limparTitulo, nichoDe, pendenciasDe, publicoDe, taxaEngajamento } from "./extras";
import { contraste, temaDaPaleta, TEMA_MANTORA, variaveisDoTema } from "./tema";

describe("dados extras", () => {
  it("números da conta e taxa de engajamento", () => {
    const c = contaIgDe({ reach: 5353, views: 22329, accounts_engaged: 293, total_interactions: 448, seguiram: 33, deixaram: 6 });
    expect(c).toEqual({ alcance: 5353, visualizacoes: 22329, engajadas: 293, interacoes: 448, seguiram: 33, deixaram: 6 });
    expect(taxaEngajamento(c)).toBe(5.5);
    expect(contaIgDe({})).toBeNull();
  });

  it("público em porcentagem e na ordem das faixas", () => {
    const p = publicoDe({
      idade: [
        { chave: "35-44", valor: 343 },
        { chave: "25-34", valor: 228 },
        { chave: "18-24", valor: 35 },
      ],
      genero: [
        { chave: "F", valor: 405 },
        { chave: "M", valor: 325 },
        { chave: "U", valor: 83 },
      ],
      cidade: [{ chave: "Santos, São Paulo (state)", valor: 59 }],
    })!;
    expect(p.idade.map((x) => x.faixa)).toEqual(["18-24", "25-34", "35-44"]);
    expect(p.mulheres).toBe(49.8);
    expect(p.cidades[0]).toEqual({ cidade: "Santos", pct: 9.7 });
  });

  it("nicho: mesma régua, sem perfis com curtidas escondidas", () => {
    const n = nichoDe(
      [
        { perfil: "cliente", seguidores: 1000, engajamento: 6.4 },
        { perfil: "a", seguidores: 5000, engajamento: 2 },
        { perfil: "b", seguidores: 5000, engajamento: 2.2 },
        { perfil: "c", seguidores: 5000, engajamento: 7 },
        { perfil: "d", seguidores: 5000, engajamento: 0 }, // curtidas escondidas
        { perfil: "e", erro: "não é conta comercial" },
      ],
      "Cliente",
    )!;
    expect(n.total).toBe(3);
    expect(n.media).toBe(3.73);
    expect(n.vezes).toBe(1.7);
    expect(n.topo_pct).toBe(50); // 2º de 4
    expect(n.fora?.map((f) => f.perfil)).toEqual(["d", "e"]);
    expect(nichoDe([{ perfil: "cliente", seguidores: 1, engajamento: 1 }], "cliente")?.cliente).toBeNull();
    expect(nichoDe([], "cliente")).toBeNull();
  });

  it("o que depende do cliente, com título limpo", () => {
    expect(limparTitulo("Bruna Reels | Inseminação intrauterina", "Bruna Cavalcante")).toEqual({ tipo: "Vídeo", titulo: "Inseminação intrauterina" });
    expect(limparTitulo("Sabrina - Gravar um tutorial de ferramentas", "Sabrina Nascimento")).toEqual({ tipo: "Gravação", titulo: "Gravar um tutorial de ferramentas" });
    const p = pendenciasDe(
      [{ nome: "Bruna Carrossel | Ultrassom", atualizada: Date.parse("2026-11-05T15:00:00Z") }],
      [{ titulo: "Carrossel Black Friday", criado_em: "2026-11-01T10:00:00Z", link: "/aprovar/x" }],
      "Dra. Bruna Cavalcante",
    );
    expect(p.map((x) => [x.tipo, x.titulo, x.desde])).toEqual([
      ["Aprovação", "Carrossel Black Friday", "2026-11-01"],
      ["Carrossel", "Ultrassom", "2026-11-05"],
    ]);
  });

  it("comentários candidatos: sem emoji solto, contato ou repetido", () => {
    const c = comentariosCandidatos([
      { media_id: "1", texto: "🔥🔥🔥", curtidas: 9 },
      { media_id: "1", texto: "Que aula!", curtidas: 1 },
      { media_id: "1", texto: "Me chama no 11999998888 por favor", curtidas: 1 },
      { media_id: "2", texto: "@amiga olha isso, mudou minha forma de ver o meu negócio", curtidas: 3 },
      { media_id: "3", texto: "Olha isso, mudou minha forma de ver o meu negócio", curtidas: 0 },
    ]);
    expect(c.map((x) => x.texto)).toEqual(["olha isso, mudou minha forma de ver o meu negócio"]);
  });

  it("leitura do número contra o normal do cliente", () => {
    expect(leitura(130, 100)).toEqual({ tom: "bom", texto: "acima do seu normal" });
    expect(leitura(100, 100)?.tom).toBe("normal");
    expect(leitura(70, 100)?.tom).toBe("atencao");
    expect(leitura(8, 10, true)?.tom).toBe("bom");
    expect(leitura(10, null)).toBeNull();
  });
});

describe("antes e depois", () => {
  const lado = (a: number | null, s: number | null) => ({ rotulo: "x", mediana_alcance: a, mediana_salvos_compart: s, posts: 10 });
  it("só aparece quando melhorou", () => {
    expect(antesDepoisMelhorou({ antes: lado(34900, 900), depois: lado(17500, 800), capas_antes: [], capas_depois: [] })).toBe(false);
    expect(antesDepoisMelhorou({ antes: lado(10000, 100), depois: lado(12000, 90), capas_antes: [], capas_depois: [] })).toBe(true);
    expect(antesDepoisMelhorou({ antes: lado(10000, 100), depois: lado(9000, 150), capas_antes: [], capas_depois: [] })).toBe(true);
    expect(antesDepoisMelhorou(null)).toBe(false);
  });
});

describe("tema do cliente", () => {
  it("usa o escuro da paleta e um destaque que aparece nos dois fundos", () => {
    const t = temaDaPaleta({ background: "#241A0D", text: "#FEFCED", accent: "#5E502C" }, "kit")!;
    expect(contraste(t.escuro, "#ffffff")).toBeGreaterThanOrEqual(10);
    expect(contraste(t.destaque, t.escuro)).toBeGreaterThanOrEqual(2.6);
    expect(contraste(t.destaque, "#ffffff")).toBeGreaterThanOrEqual(2.6);
  });
  it("paleta clara (fundo bege) ainda gera um escuro", () => {
    const t = temaDaPaleta({ background: "#F1EEE9", text: "#1F1B18", accent: "#E8736C" }, "estilo")!;
    expect(t.escuro.toLowerCase()).toBe("#1f1b18");
    expect(contraste(t.destaque, "#ffffff")).toBeGreaterThanOrEqual(2.6);
  });
  it("destaque cinza vira o da Mantora; sem paleta, nada", () => {
    expect(temaDaPaleta({ background: "#151515", text: "#FBFBFB", accent: "#777777" }, "kit")!.destaque).toBe(TEMA_MANTORA.destaque);
    expect(temaDaPaleta(null, "kit")).toBeNull();
    expect(Object.keys(variaveisDoTema(TEMA_MANTORA))).toContain("--rs-violet");
  });
});
