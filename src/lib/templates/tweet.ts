// Template do card "Carrossel Tweet": cada slide vira um post no estilo X/Twitter.
// O mesmo HTML é usado no preview do editor e na imagem final (PNG).

import { CANVAS_SIZES, type TweetCanvasSizeId } from "../formats";
import { escapeHtml, formatRichText, htmlDocument, initials, safeImageSrc } from "./utils";

export type TweetTheme = "light" | "dark";

export interface TweetProfile {
  name: string;
  handle: string;
  /** Data URL da foto de perfil. Sem ela, usa as iniciais. */
  avatar?: string | null;
  verified: boolean;
}

export interface TweetSlide {
  text: string;
  /** Data URL de uma imagem opcional exibida abaixo do texto. */
  image?: string | null;
}

export interface TweetStyle {
  theme: TweetTheme;
  size: TweetCanvasSizeId;
}

const THEMES: Record<TweetTheme, { bg: string; text: string; muted: string; border: string }> = {
  light: { bg: "#FFFFFF", text: "#0F1419", muted: "#536471", border: "#CFD9DE" },
  dark: { bg: "#000000", text: "#E7E9EA", muted: "#71767B", border: "#2F3336" },
};

const VERIFIED_BADGE = `<svg class="badge" viewBox="0 0 22 22" aria-hidden="true"><path fill="#1D9BF0" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/></svg>`;

/** Ajusta o tamanho da fonte ao volume de texto para o card não estourar. */
export function tweetFontSize(text: string, hasImage: boolean): number {
  const length = text.trim().length;
  const steps: [number, number][] = [
    [90, 60],
    [160, 54],
    [240, 48],
    [340, 42],
  ];
  const size = steps.find(([max]) => length <= max)?.[1] ?? 36;
  return hasImage ? Math.max(34, size - 8) : size;
}

export function renderTweetSlide(params: {
  slide: TweetSlide;
  profile: TweetProfile;
  style: TweetStyle;
  fontCss: string;
}): string {
  const { slide, profile, style, fontCss } = params;
  const { width, height } = CANVAS_SIZES[style.size];
  const colors = THEMES[style.theme];

  const avatarSrc = safeImageSrc(profile.avatar);
  const imageSrc = safeImageSrc(slide.image);
  const handle = profile.handle.trim().replace(/^@+/, "");
  const fontSize = tweetFontSize(slide.text, Boolean(imageSrc));

  const avatar = avatarSrc
    ? `<img class="avatar" src="${avatarSrc}" alt=""/>`
    : `<div class="avatar initials">${escapeHtml(initials(profile.name))}</div>`;

  const css = `
body{background:${colors.bg};font-family:"Inter",Arial,sans-serif;color:${colors.text}}
.card{width:${width}px;height:${height}px;padding:80px 76px;display:flex;flex-direction:column;justify-content:center}
.header{display:flex;align-items:center;gap:24px}
.avatar{width:128px;height:128px;border-radius:50%;object-fit:cover;flex-shrink:0}
.initials{background:#1D9BF0;color:#fff;display:flex;align-items:center;justify-content:center;font-size:50px;font-weight:700}
.who{flex:1;min-width:0}
.name{display:flex;align-items:center;gap:10px;font-size:42px;font-weight:700;line-height:1.2}
.name span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.badge{width:40px;height:40px;flex-shrink:0}
.handle{font-size:32px;color:${colors.muted};margin-top:4px}
.text{margin-top:44px;font-size:${fontSize}px;line-height:1.32;letter-spacing:-0.01em;overflow-wrap:break-word}
.text strong{font-weight:700}
.media{margin-top:40px;border:1px solid ${colors.border};border-radius:28px;overflow:hidden}
.media img{display:block;width:100%;max-height:${Math.round(height * 0.38)}px;object-fit:cover}
`;

  const body = `<div class="card">
  <div class="header">
    ${avatar}
    <div class="who">
      <div class="name"><span>${escapeHtml(profile.name.trim() || "Seu Nome")}</span>${profile.verified ? VERIFIED_BADGE : ""}</div>
      <div class="handle">@${escapeHtml(handle || "seuusuario")}</div>
    </div>
  </div>
  <div class="text">${formatRichText(slide.text)}</div>
  ${imageSrc ? `<div class="media"><img src="${imageSrc}" alt=""/></div>` : ""}
</div>`;

  return htmlDocument({ width, height, fontCss, css, body });
}
