// Reading what a competitor's website shows beyond its ads (the rules are in rules/site.mjs): the Google Tag Manager
// containers it loads (pixels are often only in there), robots.txt and llms.txt (which AI assistants may read it), its
// sitemaps (pages for each town, its blog) and its home page as the web archive kept it about a year ago. All at once,
// each with a short time limit; nothing here fails a report, and anything not read stays unknown.
import { fetchPublic, PLAIN_UA, READER_UA, within } from "./http.mjs";
import { containerTools, gtmIds, isHtml, sitemapEntries, siteSummary } from "./rules/site.mjs";

const MAX_SITEMAPS = 8;
const MAX_URLS = 20_000;

/** A file from the site, asked for as a plain reader and then under a plain name (some sites refuse one of them). */
async function fetchAs(url, opts) {
  let got = null;
  for (const ua of [READER_UA, PLAIN_UA]) {
    got = await fetchPublic(url, { ...opts, headers: { "User-Agent": ua } });
    if (got.ok || got.status === 404 || got.status === 410) return got;
  }
  return got;
}
const textOf = (got) => (got?.ok ? new TextDecoder().decode(got.bytes) : null);

/** The tools inside each Tag Manager container the page loads. */
async function readContainers(html) {
  const got = await Promise.all(
    gtmIds(html).map(async (id) => {
      const js = textOf(await fetchPublic(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`, { timeoutMs: 12_000, maxBytes: 4_000_000 }));
      return js ? { id, tools: containerTools(js) } : null;
    }),
  );
  return got.filter(Boolean);
}

/** A small text file at the site's root: its text, "" when the site has none (404), null when it couldn't be read. */
async function rootFile(origin, name) {
  const got = await fetchAs(`${origin}/${name}`, { timeoutMs: 8_000, maxBytes: 400_000 });
  if (got.ok) {
    const text = new TextDecoder().decode(got.bytes);
    return isHtml(text) ? "" : text;
  }
  return got.status === 404 || got.status === 410 ? "" : null;
}

/** Every page address the site's sitemaps list (one index level deep), posts marked by the sitemap they came from. */
async function readSitemaps(origin, named) {
  const start = named.length ? named : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/wp-sitemap.xml`];
  const entries = [];
  const read = async (url) => {
    const xml = textOf(await fetchAs(url, { timeoutMs: 10_000, maxBytes: 8 * 1024 * 1024 }));
    return xml && /<(urlset|sitemapindex)[\s>]/i.test(xml.slice(0, 3000)) ? sitemapEntries(xml) : null;
  };
  for (const url of start.slice(0, 3)) {
    const first = await read(url);
    if (!first) continue;
    entries.push(...first.urls);
    // Pages and posts first; image and video sitemaps say nothing about pages.
    const children = first.children.filter((c) => !/image|video|attachment|author|category|tag/i.test(c)).slice(0, MAX_SITEMAPS);
    // A sitemap of its own for service areas or locations is a list of town pages; one of posts is the blog.
    const kind = (c) => {
      const name = c.split("/").pop() ?? "";
      return { town: /service[_-]?areas?|locations?|cities|city|communit|areas?[_-]served/i.test(name), post: /post|blog|article|news/i.test(name) };
    };
    const parts = await Promise.all(children.map((c) => read(c).then((p) => (p ? p.urls.map((u) => ({ ...u, ...kind(c) })) : []))));
    for (const p of parts) entries.push(...p);
    if (entries.length) break;
  }
  return entries.slice(0, MAX_URLS);
}

/** The home page as the web archive kept it about a year ago (9 to 16 months back), or null. */
async function readYearAgo(host, now) {
  const target = new Date(now - 365 * 86_400_000);
  const stamp = `${target.getUTCFullYear()}${String(target.getUTCMonth() + 1).padStart(2, "0")}${String(target.getUTCDate()).padStart(2, "0")}`;
  const text = textOf(await fetchPublic(`https://archive.org/wayback/available?url=${encodeURIComponent(host)}&timestamp=${stamp}`, { timeoutMs: 15_000, headers: { "User-Agent": READER_UA } }));
  let closest;
  try {
    closest = JSON.parse(text ?? "{}")?.archived_snapshots?.closest;
  } catch {
    return null;
  }
  const ts = String(closest?.timestamp ?? "");
  if (!closest?.available || !/^\d{14}$/.test(ts) || String(closest.status ?? "200") !== "200") return null;
  const taken = Date.UTC(Number(ts.slice(0, 4)), Number(ts.slice(4, 6)) - 1, Number(ts.slice(6, 8)));
  const age = (now - taken) / 86_400_000;
  if (age < 270 || age > 490) return null;
  const html = textOf(await fetchPublic(`https://web.archive.org/web/${ts}id_/https://${host}/`, { timeoutMs: 20_000, maxBytes: 3_000_000, headers: { "User-Agent": READER_UA } }));
  if (!html || html.length < 400) return null;
  return { html, month: `${ts.slice(0, 4)}-${ts.slice(4, 6)}`, link: `https://web.archive.org/web/${ts}/https://${host}/` };
}

/**
 * One competitor's site check. `html` is its home page (already read with its ads). Never throws: a site that couldn't
 * be opened comes back as { read: false }.
 */
export async function checkSite({ url, html, service, googlePhone, now = Date.now(), timeoutMs = 60_000 }) {
  if (!url || !html) return siteSummary({ url, html: null });
  let origin;
  let host;
  try {
    const u = new URL(url);
    origin = u.origin;
    host = u.hostname.replace(/^www\./, "");
  } catch {
    return siteSummary({ url, html: null });
  }
  const [containers, robots, llms, archive] = await Promise.all([
    within(readContainers(html), timeoutMs, []),
    within(rootFile(origin, "robots.txt"), 12_000, null),
    within(rootFile(origin, "llms.txt"), 12_000, null),
    within(readYearAgo(host, now), Math.min(timeoutMs, 45_000), null),
  ]);
  const named = robots ? [...robots.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]).filter((u) => /^https?:\/\//i.test(u)) : [];
  const entries = await within(readSitemaps(origin, named), Math.min(timeoutMs, 40_000), []);
  return siteSummary({ url, html, containers, robots, llms, entries, service, googlePhone, archive, now });
}
