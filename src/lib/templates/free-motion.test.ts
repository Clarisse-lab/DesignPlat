import { describe, expect, it } from "vitest";
import { applyMotionPreset, buildPreset, hasMotion, motionDuration, renderFreeSlide, type FreeSlide } from "./free";

const render = (free: FreeSlide, animate: boolean) =>
  renderFreeSlide({
    free,
    image: null,
    brand: { name: "F", handle: "f", logo: null },
    palette: { background: "#0F2338", text: "#F3E7CF", accent: "#F2B33D" },
    titleFont: "display",
    width: 1080,
    height: 1350,
    index: 0,
    total: 5,
    fontCss: "",
    animate,
  });

describe("animação da tela", () => {
  const capa = () => buildPreset("doc-capa", { title: "Folga **na bala**", body: "UM DIA DE FOLGA ×", hasImage: true }, { placeholders: false });

  it("Impacto: a linha de cima abre, o título sobe e pinta o destaque, o @ entra depois", () => {
    const free = applyMotionPreset(capa(), "impacto");
    expect(hasMotion(free)).toBe(true);
    expect(free.motion?.photo).toBe(true);
    const [linha, titulo, handle] = free.elements;
    expect(titulo.anim).toBe("marca");
    expect(linha.delay!).toBeLessThan(titulo.delay!);
    expect(handle.delay!).toBeGreaterThan(titulo.delay!);
  });

  it("Palavra por palavra quebra o título em palavras só no vídeo/prévia", () => {
    const free = applyMotionPreset(buildPreset("doc-dividida", { title: "Folga é pra deitar", body: "Folga é o dia", hasImage: true }, { placeholders: false }), "palavras");
    expect(render(free, false)).not.toContain("@keyframes");
    const html = render(free, true);
    expect(html.match(/class="aw"/g)?.length).toBe(4);
    expect(html).toContain("a-zoom");
  });

  it("Sem animação limpa tudo e a duração fica entre 3 e 15 s", () => {
    const none = applyMotionPreset(applyMotionPreset(capa(), "suave"), "nenhuma");
    expect(hasMotion(none)).toBe(false);
    expect(render(none, true)).not.toContain("@keyframes");
    expect(motionDuration({ ...none, motion: { duration: 40 } })).toBe(15);
    expect(motionDuration(null)).toBe(6);
  });
});
