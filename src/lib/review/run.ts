// Roda a revisão no navegador: monta cada tela num iframe escondido (sem animação) e confere.

import { CANVAS_SIZES } from "../formats";
import type { FeedBrand, FeedSlide, FeedStyle } from "../templates/feed";
import { renderFeedSlide, sectionNumberAt } from "../templates/feed";
import { browserFontCss } from "../templates/fonts";
import { domChecks, staticChecks, type ReviewIssue } from "./checks";

async function loadInto(frame: HTMLIFrameElement, html: string): Promise<Document | null> {
  await new Promise<void>((resolve) => {
    const done = () => resolve();
    frame.addEventListener("load", done, { once: true });
    frame.srcdoc = html;
    setTimeout(done, 4000);
  });
  const doc = frame.contentDocument;
  if (!doc) return null;
  await Promise.race([doc.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]);
  await Promise.all(Array.from(doc.images).map((img) => (img.complete ? null : img.decode().catch(() => null))));
  return doc;
}

export async function runReview(input: {
  slides: FeedSlide[];
  brand: FeedBrand;
  style: FeedStyle;
  legenda?: string | null;
}): Promise<ReviewIssue[]> {
  const issues = staticChecks({ slides: input.slides, handle: input.brand.handle ?? "", legenda: input.legenda });
  const { width, height } = CANVAS_SIZES[input.style.size];
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = `position:fixed;left:-20000px;top:0;width:${width}px;height:${height}px;border:0;visibility:hidden;pointer-events:none`;
  document.body.appendChild(frame);
  try {
    for (let i = 0; i < input.slides.length; i++) {
      const slide = input.slides[i];
      const html = renderFeedSlide({
        slide,
        brand: input.brand,
        style: input.style,
        index: i,
        total: input.slides.length,
        fontCss: browserFontCss,
        sectionNumber: sectionNumberAt(input.slides, i),
      });
      const doc = await loadInto(frame, html);
      if (!doc) continue;
      issues.push(...domChecks(doc, i, { width, height, photoBg: slide.layout === "livre" ? slide.free?.bg === "foto" : Boolean(slide.image) }));
    }
  } finally {
    frame.remove();
  }
  // Uma vez por elemento e mensagem (a sobreposição pode aparecer de dois lados).
  const seen = new Set<string>();
  return issues.filter((x) => {
    const key = `${x.tela}|${x.elementId ?? ""}|${x.msg}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
