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

/** Envolve o corpo num documento HTML completo com tamanho fixo de canvas. */
export function htmlDocument(params: { width: number; height: number; fontCss: string; css: string; body: string }): string {
  const { width, height, fontCss, css, body } = params;
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
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
