// Meta's Ad Library (facebook.com/ads/library): every ad running on Facebook and Instagram, public and free to look
// at. It has no API for ordinary business ads (Meta's API only covers political and social-issue ads in the US), and
// the page is built by JavaScript, so it is read the way a person would see it: in a real browser.
//
//  1. Your own Chrome, Edge, Chromium or Brave, started hidden with a fresh, empty profile (free; nothing of yours is
//     used or touched). Set ZUSPY_BROWSER to its path if it isn't found.
//  2. Firecrawl (https://firecrawl.dev), when FIRECRAWL_API_KEY is set: their browsers render the page. About one
//     credit a search.
//
// The page ships its first ~30 ads as JSON inside <script> tags; the rules in rules/ads.mjs read them.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { browserPath, firecrawlKey, metaMode } from "../config.mjs";

const CANDIDATES = {
  win32: [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    `${process.env.LOCALAPPDATA ?? ""}/Google/Chrome/Application/chrome.exe`,
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  ],
  linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/snap/bin/chromium", "/usr/bin/microsoft-edge", "/usr/bin/brave-browser"],
};

/** The browser ZuSpy would start, or null. */
export function findBrowser() {
  const own = browserPath();
  if (own) return existsSync(own) ? own : null;
  return (CANDIDATES[process.platform] ?? CANDIDATES.linux).find((p) => p && existsSync(p)) ?? null;
}

let running = 0;
const queue = [];
/** At most two hidden browsers at once: each is a full browser. */
async function slot() {
  if (running < 2) {
    running++;
    return;
  }
  await new Promise((r) => queue.push(r));
  running++;
}
function release() {
  running--;
  queue.shift()?.();
}

/** The page's HTML once its scripts have run, from a hidden browser with an empty profile; null on failure. */
export async function browserHtml(url, timeoutMs = 75_000) {
  const exe = findBrowser();
  if (!exe) return null;
  await slot();
  const profile = mkdtempSync(join(tmpdir(), "zuspy-browser-"));
  try {
    return await new Promise((resolve) => {
      const args = [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-sync",
        "--mute-audio",
        `--user-data-dir=${profile}`,
        "--window-size=1280,2000",
        "--virtual-time-budget=20000",
        "--dump-dom",
        url,
      ];
      if (process.platform === "linux" && process.getuid?.() === 0) args.unshift("--no-sandbox");
      const child = spawn(exe, args, { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
      const chunks = [];
      let size = 0;
      child.stdout.on("data", (c) => {
        size += c.length;
        if (size < 40 * 1024 * 1024) chunks.push(c);
      });
      const timer = setTimeout(() => child.kill(), timeoutMs);
      child.on("error", () => {
        clearTimeout(timer);
        resolve(null);
      });
      child.on("close", () => {
        clearTimeout(timer);
        const html = Buffer.concat(chunks).toString("utf8");
        resolve(html.length > 2000 ? html : null);
      });
    });
  } finally {
    release();
    // The browser can hold its profile for a moment after it exits.
    setTimeout(() => {
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
      } catch {
        /* the OS cleans its temp folder */
      }
    }, 1500).unref?.();
  }
}

/** The page through Firecrawl's browsers; null without a key or on failure. */
export async function firecrawlHtml(url, { proxy = "basic", timeoutMs = 75_000, meter } = {}) {
  const key = firecrawlKey();
  if (!key || timeoutMs < 15_000) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["rawHtml"],
        onlyMainContent: false,
        waitFor: 5000,
        timeout: Math.min(60_000, timeoutMs - 5_000),
        maxAge: 0,
        proxy,
        location: { country: "US", languages: ["en-US"] },
      }),
      signal: AbortSignal.timeout(Math.min(75_000, timeoutMs)),
    });
    const data = await res.json().catch(() => null);
    meter?.add("firecrawl", 0, 1);
    const html = String(data?.data?.rawHtml ?? data?.rawHtml ?? "");
    return res.ok && html.length > 2000 ? html : null;
  } catch {
    return null;
  }
}

/** How the Ad Library will be read on this computer, for `zuspy doctor` and the report. */
export function metaReader() {
  const mode = metaMode();
  if (mode === "off") return { how: "off", detail: "turned off (ZUSPY_META=off)" };
  const browser = mode === "firecrawl" ? null : findBrowser();
  const firecrawl = mode === "browser" ? null : firecrawlKey();
  if (browser && firecrawl) return { how: "browser+firecrawl", detail: `your browser (${browser}), then Firecrawl` };
  if (browser) return { how: "browser", detail: `your browser (${browser})` };
  if (firecrawl) return { how: "firecrawl", detail: "Firecrawl" };
  return { how: "none", detail: "no browser found and no FIRECRAWL_API_KEY: Facebook and Instagram ads will be skipped" };
}

/** An Ad Library page, by whichever reader is set up; null when none could read it. */
export async function libraryHtml(url, { meter, timeoutMs = 75_000, stealth = false } = {}) {
  const mode = metaMode();
  if (mode === "off") return null;
  if (mode !== "firecrawl" && findBrowser()) {
    const html = await browserHtml(url, timeoutMs);
    if (html && /ad_archive_id|adArchiveID/.test(html)) return html;
    if (html && !firecrawlKey()) return html;
  }
  if (mode !== "browser") return firecrawlHtml(url, { proxy: stealth ? "stealth" : "basic", timeoutMs, meter });
  return null;
}
