import "server-only";
// Tela animada → MP4: o Chromium abre o HTML com as animações em CSS, a gente congela o relógio das
// animações e fotografa quadro a quadro; o ffmpeg junta os quadros num vídeo H.264 (sem áudio).

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getBrowser } from "./browser";
import type { HtmlPage } from "./html-to-image";

export const VIDEO_FPS = 30;

export async function renderHtmlToMp4(input: HtmlPage & { seconds: number }): Promise<Buffer> {
  const seconds = Math.min(15, Math.max(3, input.seconds));
  const frames = Math.round(seconds * VIDEO_FPS);
  const dir = await mkdtemp(join(tmpdir(), "video-"));
  const out = join(dir, "tela.mp4");

  // -preset veryfast: bom equilíbrio de tempo e tamanho para um vídeo curto de tela.
  const ffmpeg = spawn(
    process.env.FFMPEG_PATH || "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(VIDEO_FPS), "-c:v", "mjpeg", "-i", "-",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let stderr = "";
  ffmpeg.stderr.on("data", (d) => (stderr += String(d)));
  const done = new Promise<void>((resolve, reject) => {
    ffmpeg.on("error", (e) => reject(new Error(`ffmpeg não disponível: ${e.message}`)));
    ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg saiu com ${code}: ${stderr.slice(0, 300)}`))));
  });
  done.catch(() => undefined); // o erro é tratado no await abaixo; isto evita o aviso de promessa sem tratamento
  ffmpeg.stdin.on("error", () => undefined);

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().startsWith("data:")) request.continue();
      else request.abort();
    });
    await page.setViewport({ width: input.width, height: input.height, deviceScaleFactor: 1 });
    await page.setContent(input.html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(() => document.fonts.ready);
    for (let f = 0; f < frames; f++) {
      const ms = (f * 1000) / VIDEO_FPS;
      // Relógio das animações congelado no instante do quadro: o vídeo sai igual, rápido ou lento o servidor.
      await page.evaluate((t: number) => {
        for (const a of document.getAnimations()) {
          a.pause();
          a.currentTime = t;
        }
      }, ms);
      const jpg = await page.screenshot({ type: "jpeg", quality: 92, clip: { x: 0, y: 0, width: input.width, height: input.height }, optimizeForSpeed: true });
      if (!ffmpeg.stdin.write(jpg)) await new Promise((r) => ffmpeg.stdin.once("drain", r));
    }
    ffmpeg.stdin.end();
    await done;
    return await readFile(out);
  } catch (error) {
    ffmpeg.kill("SIGKILL");
    throw error;
  } finally {
    await page.close().catch(() => undefined);
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
