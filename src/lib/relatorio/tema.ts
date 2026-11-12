// Cores do relatório de cada cliente. A apresentação usa duas cores de base (um escuro e um destaque)
// e deriva o resto (lilases claros, gradientes). Vêm do estilo padrão do cliente no Design Mantora,
// do kit de marca lido do Instagram, ou da escolha da equipe; sem nada disso, ficam as cores da Mantora.

import type { Tema } from "./tipos";

export const TEMA_MANTORA: Tema = { escuro: "#24002f", destaque: "#704bfd", origem: "mantora" };

type RGB = [number, number, number];
const HEX = /^#?([0-9a-f]{6})$/i;

export function hexValido(h: unknown): h is string {
  return typeof h === "string" && HEX.test(h.trim());
}
function rgb(h: string): RGB {
  const v = HEX.exec(h.trim())![1];
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16)) as RGB;
}
function hex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("")}`;
}
/** Mistura duas cores (t = 0 fica a primeira, 1 fica a segunda). */
export function misturar(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([0, 1, 2].map((i) => x[i] + (y[i] - x[i]) * t) as RGB);
}
/** Luminância relativa (WCAG). */
export function luminancia(h: string): number {
  const [r, g, b] = rgb(h).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function saturacao(h: string): number {
  const [r, g, b] = rgb(h).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/**
 * Monta o tema a partir de uma paleta qualquer (fundo, texto, destaque).
 * O escuro é a cor mais escura da paleta, escurecida se precisar para o texto branco ler bem.
 * O destaque precisa aparecer no fundo claro e no escuro; se não aparecer (ou for cinza), vira uma versão mais viva.
 */
export function temaDaPaleta(p: { background?: string; text?: string; accent?: string } | null | undefined, origem: string): Tema | null {
  const cores = [p?.background, p?.text, p?.accent].filter(hexValido);
  if (cores.length < 2 || !hexValido(p?.accent)) return null;
  let escuro = [...cores].sort((a, b) => luminancia(a) - luminancia(b))[0];
  while (contraste(escuro, "#ffffff") < 10 && luminancia(escuro) > 0.002) escuro = misturar(escuro, "#000000", 0.25);
  let destaque = p!.accent as string;
  if (saturacao(destaque) < 0.25) return { escuro, destaque: TEMA_MANTORA.destaque, origem };
  // Destaque escuro demais some no fundo escuro: clareia até ter contraste com ele.
  for (let i = 0; i < 6 && contraste(destaque, escuro) < 2.6; i++) destaque = misturar(destaque, "#ffffff", 0.18);
  // E claro demais some no fundo claro: escurece até ter contraste com o branco.
  for (let i = 0; i < 6 && contraste(destaque, "#ffffff") < 2.6; i++) destaque = misturar(destaque, "#000000", 0.15);
  return { escuro, destaque, origem };
}

/** As variáveis de CSS do relatório para um tema. */
export function variaveisDoTema(t: Tema | null | undefined): Record<string, string> {
  if (!t || !hexValido(t.escuro) || !hexValido(t.destaque)) return {};
  const { escuro, destaque } = t;
  return {
    "--rs-plum": escuro,
    "--rs-deep": misturar(escuro, destaque, 0.28),
    "--rs-violet": destaque,
    "--rs-lilac": misturar(destaque, "#ffffff", 0.7),
    "--rs-lilac-2": misturar(destaque, "#ffffff", 0.88),
    "--rs-line": misturar(destaque, "#ffffff", 0.84),
    "--rs-claro": misturar(destaque, "#ffffff", 0.45),
    "--rs-claro-2": misturar(destaque, "#ffffff", 0.72),
    "--rs-g1": `linear-gradient(140deg, ${destaque} 0%, ${misturar(escuro, destaque, 0.35)} 55%, ${escuro} 100%)`,
    "--rs-g2": `linear-gradient(150deg, ${misturar(destaque, "#ffffff", 0.45)} 0%, ${misturar(escuro, destaque, 0.5)} 45%, ${escuro} 100%)`,
    "--rs-g3": `linear-gradient(140deg, ${escuro} 0%, ${misturar(escuro, destaque, 0.45)} 50%, ${misturar(destaque, "#ffffff", 0.5)} 100%)`,
    "--rs-g4": `linear-gradient(160deg, ${misturar(destaque, "#ffffff", 0.3)} 0%, ${destaque} 50%, ${escuro} 100%)`,
  };
}
