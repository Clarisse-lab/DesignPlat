// Limpeza do HTML/CSS de layouts personalizados (gerados pela IA a partir de uma referência).
// É uma camada extra: os documentos já são renderizados com CSP que bloqueia scripts e
// recursos externos. Aqui removemos o que nunca deveria estar num template de imagem.

const BLOCKED_ELEMENTS = [
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "video",
  "audio",
  "source",
  "foreignobject",
  "template",
  "noscript",
];

export function sanitizeLayoutHtml(html: string): string {
  let out = html;
  for (const tag of BLOCKED_ELEMENTS) {
    // elemento com conteúdo e depois tags soltas (abertura ou fechamento)
    out = out.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "");
  }
  return (
    out
      // atributos de evento (onclick, onload…)
      .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      // src/href/xlink:href que não sejam data:image ou placeholder
      .replace(/\s+(?:xlink:)?(src|href|srcset|action|formaction|poster)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, (match, _name, value: string) => {
        const v = value.replace(/^["']|["']$/g, "").trim();
        return /^data:image\/(png|jpeg|webp|gif);/i.test(v) || /^\{\{\w+\}\}$/.test(v) ? match : "";
      })
      // estilos inline passam pela mesma limpeza do CSS
      .replace(/\s+style\s*=\s*("([^"]*)"|'([^']*)')/gi, (_match, _value, double?: string, single?: string) => {
        const cleaned = sanitizeLayoutCss(double ?? single ?? "").replace(/"/g, "'");
        return ` style="${cleaned}"`;
      })
      .replace(/javascript:/gi, "")
  );
}

export function sanitizeLayoutCss(css: string): string {
  return (
    css
      // impede fechar a tag <style> e injetar HTML
      .replace(/<\/?\s*style/gi, "")
      .replace(/<!--|-->/g, "")
      .replace(/@import[^;]*;?/gi, "")
      // só aceita url(data:image/...) ou o placeholder da imagem do slide — qualquer outra url() é removida
      .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (match, _quote, value: string) =>
        /^data:image\//i.test(value.trim()) || value.trim() === "{{image_url}}" ? match : "none",
      )
      .replace(/expression\s*\(/gi, "")
      .replace(/behavior\s*:/gi, "")
      .replace(/-moz-binding\s*:/gi, "")
  );
}
