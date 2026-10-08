import "server-only";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";

const CANDIDATE_PATHS = [
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/opt/pw-browsers/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findChromium(): string {
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  for (const cmd of ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"]) {
    try {
      const found = execFileSync("which", [cmd], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (found && existsSync(found)) return found;
    } catch {
      // comando não existe neste sistema
    }
  }

  const fallback = CANDIDATE_PATHS.find((p) => existsSync(p));
  if (fallback) return fallback;
  throw new Error("Chromium não encontrado. Instale o Chromium ou defina CHROMIUM_PATH.");
}

// Um único navegador por processo, reaproveitado entre requisições.
let browserPromise: Promise<Browser> | null = null;

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: findChromium(),
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--font-render-hinting=none",
          "--disable-extensions",
        ],
      })
      .then((browser) => {
        browser.on("disconnected", () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((error) => {
        browserPromise = null;
        throw error;
      });
  }
  return browserPromise;
}
