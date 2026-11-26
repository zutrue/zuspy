// `zuspy watch`: one company, checked again and again, with what changed between checks.
//
// A check reads, at once: their ads (Meta's Ad Library and Google's Ads Transparency Center), their home page (headline,
// offers, phone numbers, the tools in its source), the pages their ads send people to, their sitemap, their public job
// board (Greenhouse, Lever or Ashby) and their Google listing. That's a snapshot. The changes between two snapshots
// are found by code (rules/watch.mjs), never written by an AI, and a part that couldn't be read says nothing: an
// unread library is never "they stopped advertising". The first check also reads their last year from the web
// archive and from certificate records (new sites they put up).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { aiConfig, dataForSeoAuth, reportsDir, VERSION, ZUOPS_URL } from "./config.mjs";
import { fetchText, pageHtml, READER_UA, within } from "./http.mjs";
import { Meter } from "./meter.mjs";
import { Ai } from "./providers/ai.mjs";
import { DataForSeo } from "./providers/dataforseo.mjs";
import { metaReader } from "./providers/meta-library.mjs";
import { spyOnAds } from "./spy-ads.mjs";
import {
  adKey,
  careersLink,
  cleanWebsite,
  diffSnapshots,
  historyFromCaptures,
  historyFromCerts,
  hostOf,
  isSitemapIndex,
  jobBoardApi,
  jobBoardIn,
  jobFacts,
  landingsToRead,
  listingFrom,
  offersIn,
  pageChunks,
  pageFacts,
  siteFacts,
  sitemapLocs,
  WATCH_ADS_PER_LIBRARY,
} from "./rules/watch.mjs";
import { renderWatch } from "./report/watch-html.mjs";
import { gtmIds } from "./rules/site.mjs";

const watchRoot = () => join(reportsDir(), "watch");
const readJson = (file, fallback = null) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : fallback);
const writeJson = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

async function readPages(website) {
  const origin = new URL(website).origin;
  let first = await fetchText(`${origin}/sitemap.xml`, { timeoutMs: 10_000, maxBytes: 5 * 1024 * 1024, headers: { "User-Agent": READER_UA } });
  if (!first || !/<(urlset|sitemapindex)[\s>]/i.test(first)) {
    const robots = await fetchText(`${origin}/robots.txt`, { timeoutMs: 6_000, maxBytes: 200_000, headers: { "User-Agent": READER_UA } });
    const named = robots?.match(/^\s*sitemap:\s*(\S+)/im)?.[1];
    first = named ? await fetchText(named, { timeoutMs: 10_000, maxBytes: 5 * 1024 * 1024, headers: { "User-Agent": READER_UA } }) : null;
  }
  if (!first) return null;
  if (!isSitemapIndex(first)) return pageFacts(sitemapLocs(first));
  const children = sitemapLocs(first).slice(0, 6);
  const parts = await Promise.all(children.map((c) => fetchText(c, { timeoutMs: 9_000, maxBytes: 5 * 1024 * 1024, headers: { "User-Agent": READER_UA } })));
  return pageFacts(parts.flatMap((p) => (p ? sitemapLocs(p) : [])));
}

async function readJobs(homeHtml, website) {
  if (!homeHtml) return null;
  let board = jobBoardIn(homeHtml);
  if (!board) {
    const link = careersLink(homeHtml, website);
    if (!link) return null;
    board = jobBoardIn(link);
    if (!board) {
      const careers = await pageHtml(link, 8_000);
      board = careers ? jobBoardIn(careers) : null;
    }
  }
  if (!board) return null;
  const text = await fetchText(jobBoardApi(board), { timeoutMs: 10_000, headers: { Accept: "application/json" } });
  try {
    return text ? jobFacts(board, JSON.parse(text)) : null;
  } catch {
    return null;
  }
}

async function readLanding(url, ads, home) {
  const host = hostOf(url) ?? "";
  const base = { url, host, ads, own: !!home && (host === home || host.endsWith(`.${home}`)) };
  const html = await pageHtml(url, 9_000);
  if (!html) return { ...base, read: false, title: null, headline: null, offers: [], phones: [], tools: [], formFields: 0 };
  const f = siteFacts(html);
  return { ...base, read: true, title: f.title, headline: f.headline, offers: f.offers, phones: f.phones, tools: f.tools, formFields: f.formFields };
}

/** The home page as the web archive kept it, a few months apart, for the year before the first check. */
async function archiveHistory(host, now) {
  const from = new Date(now - 400 * 86_400_000).toISOString().slice(0, 7).replace("-", "");
  const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(host)}&output=json&from=${from}&filter=statuscode:200&collapse=timestamp:6&limit=40`;
  const text = await fetchText(cdx, { timeoutMs: 20_000, headers: { "User-Agent": READER_UA } });
  let rows = [];
  try {
    rows = (JSON.parse(text ?? "[]") ?? []).slice(1).map((row) => ({ ts: row[1], original: row[2] }));
  } catch {
    return [];
  }
  if (rows.length < 2) return [];
  const step = Math.max(1, Math.ceil(rows.length / 6));
  const picked = rows.filter((_, i) => i % step === 0 || i === rows.length - 1).slice(-7);
  const captures = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (next < picked.length) {
        const row = picked[next++];
        const html = await fetchText(`https://web.archive.org/web/${row.ts}id_/${row.original}`, { timeoutMs: 15_000, maxBytes: 2_000_000, headers: { "User-Agent": READER_UA } });
        if (!html) continue;
        const f = siteFacts(html);
        captures.push({ month: `${row.ts.slice(0, 4)}-${row.ts.slice(4, 6)}`, link: `https://web.archive.org/web/${row.ts}/${row.original}`, headline: f.headline, title: f.title, offers: offersIn(pageChunks(html), 3) });
      }
    }),
  );
  return historyFromCaptures(captures);
}

/** New subdomains by the day their first certificate was issued (crt.sh). */
async function certHistory(host, now) {
  const text = await fetchText(`https://crt.sh/?q=${encodeURIComponent(`%.${host}`)}&output=json`, { timeoutMs: 25_000, maxBytes: 10 * 1024 * 1024, headers: { "User-Agent": READER_UA } });
  let rows = [];
  try {
    rows = JSON.parse(text ?? "[]");
  } catch {
    return [];
  }
  const first = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const seen = String(row?.not_before ?? "").slice(0, 10);
    if (!seen) continue;
    for (const name of String(row?.name_value ?? "").toLowerCase().split("\n")) {
      if (!name || name.includes("*")) continue;
      if (!first.has(name) || seen < first.get(name)) first.set(name, seen);
    }
  }
  return historyFromCerts([...first].map(([name, firstSeen]) => ({ name, firstSeen })), host, new Date(now - 730 * 86_400_000).toISOString());
}

/** A short, stable folder name for a watched company. */
const keyOf = (host, name) => (host ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/[^a-z0-9.-]/g, "-").slice(0, 80);

/** Their business name when it wasn't given: the site's own name, else its title's first part, else the domain. */
function nameFrom(html, host) {
  const og = html?.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']{2,80})/i)?.[1];
  if (og) return og.trim();
  const title = html?.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
  const part = title?.split(/\s[|–—-]\s/).map((s) => s.trim()).filter((s) => s.length >= 3);
  if (part?.length) return part.sort((a, b) => a.length - b.length)[0].slice(0, 80);
  return host;
}

async function checkOne(watch, log) {
  const dir = join(watchRoot(), watch.key);
  const now = Date.now();
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const checkDir = join(dir, "checks", stamp);
  mkdirSync(checkDir, { recursive: true });
  const meter = new Meter();
  const auth = dataForSeoAuth();
  const dfs = auth ? new DataForSeo(auth, meter) : null;
  const cfg = aiConfig();
  const ai = cfg.engine === "claude-code" || !cfg.key ? null : new Ai(cfg, meter);
  const prev = readJson(join(dir, "latest.json"));
  const website = watch.website;
  const host = watch.host;

  log(`Checking ${watch.name}${website ? ` (${website})` : ""} ...`);
  const homeWork = website ? pageHtml(website, 12_000) : Promise.resolve(null);
  const home = await homeWork;
  if (!watch.nameGiven && home) watch.name = nameFrom(home, host);
  const rival = { id: "c1", name: watch.name, placeId: watch.placeId ?? null, cid: null, rating: null, reviews: null, category: null, website, address: null, lat: null, lng: null, rank: 1 };

  log(`  ads: Facebook & Instagram through ${metaReader().detail}; Google ${dfs ? "through DataForSEO" : "skipped (no DataForSEO login)"}`);
  const adsWork = spyOnAds({ dfs, ai, dir: checkDir, meter, deadline: now + 6 * 60_000, service: watch.service ?? "", location: watch.town ?? "", noMarket: true, perLibrary: WATCH_ADS_PER_LIBRARY, log }, [rival]).catch(() => null);
  const pagesWork = website ? within(readPages(website), 45_000, null) : Promise.resolve(null);
  const listingWork = dfs && watch.town ? within(dfs.maps(`${watch.name} ${watch.town}`, 10).then((items) => listingFrom(items, { placeId: watch.placeId ?? null, host, name: watch.name })), 60_000, null) : Promise.resolve(null);
  const historyWork = !prev && host ? Promise.all([within(archiveHistory(host, now), 70_000, []), within(certHistory(host, now), 30_000, [])]).then(([a, b]) => [...a, ...b]) : Promise.resolve([]);
  const jobsWork = website ? within(readJobs(home, website), 30_000, null) : Promise.resolve(null);

  const site = home ? siteFacts(home) : null;
  const spied = await adsWork;
  // Its tools as the spy's site check read them: the page's own plus the pixels inside its Tag Manager containers.
  const check = spied?.checks?.c1;
  if (site && check?.read) {
    site.tools = check.stack.map(({ name, group, hidden }) => ({ name, group, hidden }));
    // True only when every container the page loads was read, so a tool missing from one isn't "removed".
    site.tagManager = gtmIds(home).every((id) => check.gtm.includes(id));
  }
  // The check's pictures live in its own folder; the page reads them from there.
  const rel = (p) => (p && !/^https?:/.test(p) ? `checks/${stamp}/${p}` : p);
  const ads = (spied?.ads ?? []).filter((a) => a.rival === "c1").map((a) => ({ ...a, image: rel(a.image), video: rel(a.video), key: adKey(a) }));
  const adFacts = spied?.facts.c1 ?? null;
  log("  reading their website, the pages their ads lead to, sitemap, jobs and Google listing ...");
  const landings = await Promise.all(landingsToRead(ads, website).map((l) => readLanding(l.url, l.ads, host)));
  const [pages, listing, jobs, history] = await Promise.all([pagesWork, listingWork, jobsWork, historyWork]);

  const adsRead = !!adFacts && adFacts.unread.length < 2;
  if (!adsRead && !site) throw new Error(website ? "Their website and both ad libraries couldn't be read this time. Try again in a few minutes." : "The ad libraries couldn't be read this time.");

  const snapshot = {
    at: new Date(now).toISOString(),
    // A part that couldn't be read keeps the last answer, so the next check still has something to compare with.
    listing: listing ?? prev?.listing ?? null,
    site,
    pages: pages ?? prev?.pages ?? null,
    ads,
    adFacts,
    landings,
    jobs: jobs ?? null,
  };
  const changes = prev ? diffSnapshots(prev, snapshot) : history.sort((a, b) => b.at.localeCompare(a.at));
  writeJson(join(checkDir, "snapshot.json"), snapshot);
  writeJson(join(checkDir, "changes.json"), changes);
  writeJson(join(dir, "latest.json"), { ...snapshot, site: site ?? prev?.site ?? null });
  watch.checks = [...(watch.checks ?? []), { at: snapshot.at, folder: stamp, changes: changes.filter((c) => !c.history).length, cost: meter.toJSON() }];
  watch.last_check = snapshot.at;
  writeJson(join(dir, "watch.json"), watch);

  // Only the last three checks keep their pictures.
  const folders = readdirSync(join(dir, "checks")).sort();
  for (const old of folders.slice(0, -3)) rmSync(join(dir, "checks", old, "media"), { recursive: true, force: true });

  const page = renderWatch(dir);
  const fresh = changes.filter((c) => !c.history);
  log("");
  if (!prev) {
    log(`First check of ${watch.name}: ${ads.length} ads, ${site?.offers.length ?? 0} offers on their site, ${pages?.total ?? "?"} pages, ${jobs ? `${jobs.total} open jobs` : "no public job board"}.`);
    if (history.length) log(`From the web archive and certificate records, their last year: ${history.length} dated changes.`);
    log("Run the same command again later (or `zuspy watch --all` weekly) to see what changed.");
  } else if (!fresh.length) {
    log(`No changes at ${watch.name} since ${prev.at.slice(0, 10)}.`);
  } else {
    log(`${fresh.length} ${fresh.length === 1 ? "change" : "changes"} at ${watch.name} since ${prev.at.slice(0, 10)}:`);
    for (const c of fresh.slice(0, 15)) log(`  ${c.weight >= 2 ? "*" : "-"} ${c.title}${c.detail ? `: ${String(c.detail).slice(0, 140)}` : ""}${c.before && c.after ? `: "${c.before}" -> "${c.after}"` : ""}`);
  }
  log(`Cost: ${meter.line()}. Page: ${page}`);
  return page;
}

export async function watchCheck({ website, name, town, all, open, openFile, log = console.log }) {
  if (all) {
    const list = existsSync(watchRoot()) ? readdirSync(watchRoot()).filter((k) => existsSync(join(watchRoot(), k, "watch.json"))) : [];
    if (!list.length) return log("You aren't watching anyone yet. Run: zuspy watch <their website>");
    for (const k of list) {
      try {
        await checkOne(readJson(join(watchRoot(), k, "watch.json")), log);
      } catch (e) {
        log(`  ${k}: ${e?.message ?? e}`);
      }
      log("");
    }
    log(`Made with ZuSpy. Zuops runs these checks for you every week and tells you what changed: ${ZUOPS_URL}`);
    return;
  }
  const site = cleanWebsite(website);
  if (!site && !name) throw new Error("Give their website (e.g. halvorsendoors.com), and --name if you know their business name.");
  const host = hostOf(site);
  const key = keyOf(host, name ?? site);
  const dir = join(watchRoot(), key);
  mkdirSync(dir, { recursive: true });
  const existing = readJson(join(dir, "watch.json"));
  const watch = existing ?? { zuspy: VERSION, key, name: name ?? host, nameGiven: !!name, website: site, host, town: town ?? null, placeId: null, added_at: new Date().toISOString(), checks: [] };
  if (name) {
    watch.name = name;
    watch.nameGiven = true;
  }
  if (town) watch.town = town;
  const page = await checkOne(watch, log);
  log(`\nMade with ZuSpy. Zuops runs these checks for you every week and tells you what changed: ${ZUOPS_URL}`);
  if (open) openFile?.(page);
}

export function watchList(log = console.log) {
  const root = watchRoot();
  const list = existsSync(root) ? readdirSync(root).filter((k) => existsSync(join(root, k, "watch.json"))) : [];
  if (!list.length) return log("You aren't watching anyone yet. Run: zuspy watch <their website> [--name \"Their Business\"] [--town \"Phoenix, AZ\"]");
  for (const k of list) {
    const w = readJson(join(root, k, "watch.json"));
    const last = w.checks?.at(-1);
    log(`${w.name.padEnd(32)} ${String(w.website ?? "").padEnd(36)} last checked ${w.last_check?.slice(0, 10) ?? "never"}${last ? `, ${last.changes} changes` : ""}  ${join(root, k, "watch.html")}`);
  }
}

export function watchRemove(key, log = console.log) {
  const dir = join(watchRoot(), keyOf(hostOf(cleanWebsite(key)) ?? key, key));
  if (!existsSync(join(dir, "watch.json"))) return log(`Not watching ${key}.`);
  rmSync(dir, { recursive: true, force: true });
  log(`Stopped watching ${key}; its checks were deleted.`);
}
