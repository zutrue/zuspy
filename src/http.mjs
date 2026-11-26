// Fetching public web pages and files: a size cap, a time limit, and never an address on your own network (an ad's
// link or a sitemap entry is someone else's text, so it never gets to reach your router or a local service).
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
/** Some sites turn a browser's name away from a server and let a plainly named reader in. */
export const READER_UA = "Mozilla/5.0 (compatible; ZuSpy/1.0; +https://github.com/zutrue/zuspy)";
/** ...and a few answer anything with "Mozilla" in its name with an error page, but let a plain name in (2026-11-26). */
export const PLAIN_UA = "ZuSpy/1.1 (+https://github.com/zutrue/zuspy)";
/** The names a page is asked for with, in order, until one gets the page. */
export const READ_AS = [BROWSER_UA, READER_UA, PLAIN_UA];

function privateAddress(ip) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return privateAddress(v.slice(7));
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80");
}

/** True when the URL is http(s) and its host is on the public internet. */
export async function isPublicUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(u.protocol)) return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (isIP(host)) return !privateAddress(host);
  try {
    const found = await lookup(host, { all: true });
    return found.length > 0 && found.every((a) => !privateAddress(a.address));
  } catch {
    return false;
  }
}

/**
 * A public URL's bytes. Redirects are followed by hand so every hop is checked. Never throws: `ok: false` when it
 * couldn't be read.
 */
export async function fetchPublic(url, { maxBytes = 3 * 1024 * 1024, timeoutMs = 10_000, headers = {} } = {}) {
  const until = Date.now() + timeoutMs;
  let current = url;
  try {
    for (let hop = 0; hop < 6; hop++) {
      if (!(await isPublicUrl(current))) return { ok: false, status: 0, bytes: new Uint8Array(), contentType: "", url: current };
      const res = await fetch(current, {
        redirect: "manual",
        headers: { "User-Agent": BROWSER_UA, Accept: "*/*", ...headers },
        signal: AbortSignal.timeout(Math.max(1_000, until - Date.now())),
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location"), current).toString();
        await res.body?.cancel().catch(() => {});
        continue;
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !res.body) {
        await res.body?.cancel().catch(() => {});
        return { ok: false, status: res.status, bytes: new Uint8Array(), contentType, url: current };
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of res.body) {
        size += chunk.byteLength;
        if (size > maxBytes) return { ok: false, status: 413, bytes: new Uint8Array(), contentType, url: current };
        chunks.push(chunk);
      }
      const bytes = new Uint8Array(size);
      let at = 0;
      for (const c of chunks) {
        bytes.set(c, at);
        at += c.byteLength;
      }
      return { ok: true, status: res.status, bytes, contentType, url: current };
    }
  } catch {
    /* timed out or refused */
  }
  return { ok: false, status: 0, bytes: new Uint8Array(), contentType: "", url: current };
}

export async function fetchText(url, opts = {}) {
  const got = await fetchPublic(url, opts);
  return got.ok ? new TextDecoder().decode(got.bytes) : null;
}

/** A web page's HTML, trying a browser's name and then a plain reader's; null for nothing or a bot-check page. */
export async function pageHtml(url, timeoutMs = 10_000) {
  for (const ua of READ_AS) {
    const html = await fetchText(url, { timeoutMs, headers: { "User-Agent": ua, Accept: "text/html,*/*" } });
    if (!html || html.length < 400 || /<title>\s*(Just a moment|Attention Required|Access denied)/i.test(html)) continue;
    return html;
  }
  return null;
}

/** Runs the jobs a few at a time; a job that throws counts as null. */
export async function pool(jobs, size) {
  const out = jobs.map(() => null);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, jobs.length) }, async () => {
      while (next < jobs.length) {
        const i = next++;
        out[i] = await jobs[i]().catch(() => null);
      }
    }),
  );
  return out;
}

/** Resolves to `fallback` when the work fails or takes longer than `ms`. */
export const within = (work, ms, fallback) =>
  Promise.race([Promise.resolve(work).catch(() => fallback), new Promise((done) => setTimeout(() => done(fallback), ms).unref?.())]);
