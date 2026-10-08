// Utilitários compartilhados pelos templates HTML.

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escapa o texto, converte **negrito** em <strong> e quebras de linha em <br/>. */
export function formatRichText(text: string): string {
  return escapeHtml(text.trim())
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\r?\n/g, "<br/>");
}

const SAFE_IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;

/**
 * Só aceita imagens embutidas (data URL). Isso impede que o HTML renderizado
 * no servidor busque URLs externas ou injete atributos.
 */
export function safeImageSrc(value: string | undefined | null): string | null {
  return value && SAFE_IMAGE_DATA_URL.test(value) ? value : null;
}

export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
}

/**
 * Envolve o corpo num documento HTML completo com tamanho fixo de canvas.
 * A política de segurança (CSP) impede scripts e qualquer carregamento externo:
 * só estilos embutidos, imagens em data URL e as fontes da própria plataforma.
 */
export function htmlDocument(params: { width: number; height: number; fontCss: string; css: string; body: string }): string {
  const { width, height, fontCss, css, body } = params;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'self' data:"/>
<style>
${fontCss}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${width}px;height:${height}px;overflow:hidden}
body{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
${css}
</style>
</head>
<body>${body}</body>
</html>`;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Só aceita cores no formato #RRGGBB, para o valor não injetar CSS. */
export function safeColor(value: string | undefined | null, fallback: string): string {
  return value && HEX_COLOR.test(value) ? value : fallback;
}

/** Luminância relativa (WCAG) de uma cor #RRGGBB. */
export function relativeLuminance(color: string): number {
  const hex = safeColor(color, "#000000").slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste (WCAG) entre duas cores: 1 a 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Escolhe texto claro ou escuro para ficar legível sobre a cor de fundo. */
export function contrastText(background: string): string {
  return relativeLuminance(background) > 0.179 ? "#111111" : "#FFFFFF";
}

/** Primeiro tamanho cujo limite de caracteres comporta o texto. */
export function sizeByLength(text: string, steps: [maxChars: number, size: number][], fallback: number): number {
  const length = text.trim().length;
  return steps.find(([max]) => length <= max)?.[1] ?? fallback;
}
