import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./supabase", () => ({ rest: vi.fn() }));

const { autoMatches, nota, similarity, summarize } = await import("./desempenho");

const post = (media_id: string, legenda: string, dias: number, extra: Partial<{ alcance: number; salvamentos: number; compartilhamentos: number; tipo: string }> = {}) => ({
  media_id,
  publicado_em: new Date(Date.UTC(2026, 10, 1 + dias)).toISOString(),
  tipo: extra.tipo ?? "CAROUSEL_ALBUM",
  produto: "FEED",
  permalink: null,
  legenda,
  alcance: extra.alcance ?? 1000,
  salvamentos: extra.salvamentos ?? 10,
  compartilhamentos: extra.compartilhamentos ?? 5,
  curtidas: 0,
  comentarios: 0,
});
const peca = (id: string, legenda: string, estilo: string | null = null) => ({
  id,
  titulo: id,
  criado_em: new Date(Date.UTC(2026, 10, 1)).toISOString(),
  post_media_id: null as string | null,
  post_vinculo: null,
  legenda,
  estilo: estilo ? { id: "e", nome: estilo } : null,
  capa_motion: null,
});

const LEGENDA = "Folga é pra deitar e não fazer nada? Ou é o dia que você decide pra onde sua vida vai. Comente BALA que eu te mando o material. #vidanabala";

describe("desempenho", () => {
  it("nota = salvos + compartilhamentos por mil de alcance", () => {
    expect(nota({ alcance: 2000, salvamentos: 30, compartilhamentos: 10 })).toBe(20);
    expect(nota({ alcance: 0, salvamentos: 3, compartilhamentos: 1 })).toBeNull();
  });

  it("liga a peça ao post com a mesma legenda (mesmo com ajustes) e publicado depois", () => {
    expect(similarity(LEGENDA, LEGENDA.replace("Comente BALA", "Comenta BALA") + " 🔥")).toBeGreaterThan(0.8);
    const posts = [post("1", "Outro assunto qualquer sobre dinheiro e salário baixo que aperta", 2), post("2", LEGENDA.replace("material", "PDF"), 3), post("3", LEGENDA, -10)];
    expect(autoMatches([peca("a", LEGENDA)], posts)).toEqual([{ peca_id: "a", media_id: "2" }]);
  });

  it("resume por estilo contra a mediana do cliente", () => {
    const posts = [post("1", "x", 1, { salvamentos: 30, compartilhamentos: 10 }), post("2", "y", 2), post("3", "z", 3, { tipo: "VIDEO" })];
    const p = { ...peca("a", "x", "Foto documental"), post_media_id: "1", post_vinculo: "auto" as const };
    const r = summarize(posts, [p]);
    expect(r.mediana).toBe(15);
    expect(r.estilos).toEqual([{ nome: "Foto documental", posts: 1, nota: 40, vs_mediana: 167 }]);
    expect(r.melhores[0].peca).toEqual({ id: "a", estilo: "Foto documental" });
    expect(r.formatos.map((f) => f.tipo)).toEqual(["Carrossel", "Reels / vídeo"]);
  });
});
