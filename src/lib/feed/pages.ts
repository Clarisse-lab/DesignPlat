import "server-only";
import { CANVAS_SIZES } from "../formats";
import type { HtmlPage } from "../render/html-to-image";
import { inlineFontCss } from "../render/fonts";
import { renderFeedSlide, resolveFeedStyle, sectionNumberAt, type FeedBrand, type FeedSlide, type FeedStyle } from "../templates/feed";

/** Monta o HTML de cada slide do Post de Feed, Story ou Apresentação, pronto para o Chromium. */
export function buildFeedPages(input: { brand: FeedBrand; style: Partial<FeedStyle>; slides: FeedSlide[] }): HtmlPage[] {
  const style = resolveFeedStyle(input.style);
  const { width, height } = CANVAS_SIZES[style.size];
  const fontCss = inlineFontCss();
  return input.slides.map((slide, i) => ({
    html: renderFeedSlide({
      slide,
      brand: input.brand,
      style,
      index: i,
      total: input.slides.length,
      fontCss,
      sectionNumber: sectionNumberAt(input.slides, i),
    }),
    width,
    height,
  }));
}
