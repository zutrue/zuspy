// Reading each rival's ads and website (the I/O; the rules are in rules/ads.mjs).
//
// Per rival, at once: its home page (what it promises, the ad trackers in its source), Meta's Ad Library searched by
// its name, and Google's Ads Transparency Center by its domain. Pictures, video covers and a few videos are copied
// into the report's folder, because the libraries' links expire within hours. Nothing here fails a report: a library
// that can't be read is marked unread (never "no ads") and the rest goes on.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fetchPublic, fetchText, pool, BROWSER_UA } from "./http.mjs";
import { keep, mediaTypeOf } from "./media.mjs";
import { libraryHtml } from "./providers/meta-library.mjs";
import {
  firstJson,
  googleAdsFromItems,
  googleDomainUrl,
  googleRivalAd,
  MARKET,
  metaAdsFromHtml,
  metaPageUrl,
  metaRivalAd,
  metaSearchUrl,
  pickGoogleAds,
  pickMarketAds,
  pickMetaAds,
  searchName,
  siteHost,
  STORED_VIDEOS_PER_RIVAL,
  townOf,
  trackingTags,
  youtubeIdFrom,
} from "./rules/spy.mjs";

const left = (c) => c.deadline - Date.now();

/** The home page's visible words (~1,500 characters) and the ad trackers in its source. */
async function readSite(url) {
  const got = await fetchPublic(url, { maxBytes: 2 * 1024 * 1024, timeoutMs: 12_000, headers: { "User-Agent": BROWSER_UA } });
  if (!got.ok) return { text: "", tags: [], html: null };
  const html = new TextDecoder().decode(got.bytes);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { text: `${title} | ${desc} | ${body}`.replace(/\s+/g, " ").slice(0, 1500), tags: trackingTags(html), html };
}

const loginWall = (html) => /log ?in to continue|You must log in/i.test(html);

async function metaFor(c, rival, spare) {
  const query = searchName(rival.name);
  const url = metaSearchUrl(query);
  let html = await libraryHtml(url, { meter: c.meter, timeoutMs: Math.min(90_000, left(c)) });
  if (html === null && spare.searches > 0) {
    spare.searches--;
    html = await libraryHtml(url, { meter: c.meter, timeoutMs: Math.min(90_000, left(c)), stealth: true });
  }
  if (html === null) return { read: false, ads: [], total: 0, url };
  let all = metaAdsFromHtml(html);
  let picked = pickMetaAds(all, rival, c.perLibrary);
  if (!all.length && loginWall(html)) return { read: false, ads: [], total: 0, url };
  // A name the search didn't find its ads under (a long Maps name, a brand that advertises under another page): its
  // domain, which the ads' links carry.
  const host = siteHost(rival.website);
  if (!picked.total && host && spare.searches > 0) {
    spare.searches--;
    const again = await libraryHtml(metaSearchUrl(host, false), { meter: c.meter, timeoutMs: Math.min(90_000, left(c)) });
    if (again) {
      all = metaAdsFromHtml(again);
      picked = pickMetaAds(all, rival, c.perLibrary);
    }
  }
  return { read: true, ads: picked.ads, total: picked.total, url: picked.pageId ? metaPageUrl(picked.pageId) : url };
}

async function googleFor(c, rival) {
  const host = siteHost(rival.website);
  if (!host || !c.dfs) return { read: false, ads: [], total: 0, more: false, host };
  const got = await c.dfs.googleAds(host, Math.max(5_000, Math.min(45_000, left(c))));
  if (!got.read) return { read: false, ads: [], total: 0, more: false, host };
  const fresh = googleAdsFromItems(got.items);
  return { read: true, ads: pickGoogleAds(fresh, c.perLibrary), total: fresh.length, more: got.items.length >= 40 && fresh.length >= 35, host };
}

/** The YouTube video a Google video ad plays. */
async function youtubeIdOf(previewUrl) {
  const text = await fetchText(previewUrl, { timeoutMs: 10_000 });
  return text ? youtubeIdFrom(text) : null;
}

/** Google's own labels around a preview, not the ad's words. */
const PREVIEW_CHROME = /collapsed ad|expanded ad|ad on (mobile|desktop)|<[A-Za-z][^<>]{0,40}>/i;

/**
 * A Google search ad comes as a picture of the ad. The words on it, read once by the small model, so the report can
 * quote and compare them. Returns the ads whose picture turned out to be Google's layout sheet for a responsive ad
 * ("Collapsed ad on mobile ... Expanded ad"): nothing to copy there.
 */
async function readGoogleAdWords(c, ads) {
  const sheets = new Set();
  if (!c.ai) return sheets;
  const perRival = new Map();
  const readable = ads.filter((a) => a.channel === "google" && a.kind !== "video" && a.image && !/^https?:/.test(a.image)).sort((a, b) => (b.days ?? 0) - (a.days ?? 0));
  const pictures = readable.filter((a) => a.kind === "image");
  const searchAds = readable.filter((a) => {
    if (a.kind !== "text") return false;
    const n = perRival.get(a.rival) ?? 0;
    perRival.set(a.rival, n + 1);
    return n < 3;
  });
  const list = [...pictures, ...searchAds].slice(0, 24);
  if (!list.length || left(c) < 30_000) return sheets;
  // Four pictures a request: a dozen at once came back empty.
  const batches = [];
  for (let i = 0; i < list.length; i += 4) batches.push(list.slice(i, i + 4));
  await Promise.all(
    batches.map(async (batch) => {
      try {
        const images = batch.map((a) => ({ mediaType: mediaTypeOf(a.image), base64: readFileSync(join(c.dir, a.image)).toString("base64") }));
        const { text } = await c.ai.ask(
          `These are ${batch.length} Google ads, in this order: ${batch.map((a) => a.id).join(", ")}. Copy the words printed on each, exactly as written; never add or fix anything. Return JSON only: {"ads":[{"id":"...","headline":"the ad's headline or biggest line","text":"the rest of its words, in one line, or empty"}]}. An ad with no readable words: empty strings.`,
          { images, maxTokens: 4000, reader: true },
        );
        const parsed = firstJson(text);
        const byId = new Map(batch.map((a) => [a.id, a]));
        for (const row of Array.isArray(parsed?.ads) ? parsed.ads : []) {
          const ad = byId.get(String(row?.id));
          if (!ad) continue;
          const line = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) || null : null);
          const headline = line(row?.headline, 160);
          const body = line(row?.text, 500);
          if (PREVIEW_CHROME.test(`${headline ?? ""} ${body ?? ""}`)) {
            if (ad.kind === "image") sheets.add(ad.id);
            continue;
          }
          ad.headline = headline;
          ad.body = body;
        }
      } catch (e) {
        c.log(`  (couldn't read the words on some Google ads: ${String(e?.message ?? e).slice(0, 120)})`);
      }
    }),
  );
  return sheets;
}

/**
 * Each rival's ads on Meta and Google, its ad trackers and what its site says. Never throws.
 * c: { dfs, ai, dir, meter, deadline, service, location, noMarket?, perLibrary?, videos?, log }
 */
export async function spyOnAds(c, rivals) {
  const now = Date.now();
  // Extra Ad Library searches the whole run may spend (a second try, a search by domain).
  const spare = { searches: 5 };
  // Two Maps listings of one company (two locations, one website) run the same ads: looked up and listed once.
  const firstWithSite = new Map();
  const sameAs = new Map();
  for (const r of rivals) {
    const host = siteHost(r.website);
    if (!host) continue;
    if (firstWithSite.has(host)) sameAs.set(r.id, firstWithSite.get(host));
    else firstWithSite.set(host, r.id);
  }
  // Who else pays to reach the same customers: one keyword search for the service and the town.
  const marketWork = (c.noMarket ? Promise.resolve(null) : libraryHtml(metaSearchUrl(`${c.service} ${townOf(c.location)}`, false), { meter: c.meter, timeoutMs: Math.min(90_000, left(c)) }))
    .then((html) => (html ? pickMarketAds(metaAdsFromHtml(html), rivals, c.service) : []))
    .catch(() => []);
  const found = await Promise.all(
    rivals
      .filter((r) => !sameAs.has(r.id))
      .map(async (rival) => {
        const [site, meta, google] = await Promise.all([
          rival.website ? readSite(rival.website).catch(() => ({ text: "", tags: [], html: null })) : Promise.resolve({ text: "", tags: [], html: null }),
          metaFor(c, rival, spare).catch(() => ({ read: false, ads: [], total: 0, url: metaSearchUrl(searchName(rival.name)) })),
          googleFor(c, rival).catch(() => ({ read: false, ads: [], total: 0, more: false, host: siteHost(rival.website) })),
        ]);
        c.log(`  ${rival.name}: ${meta.read ? `${meta.total} Facebook/Instagram ads` : "Facebook/Instagram not read"}, ${google.read ? `${google.total}${google.more ? "+" : ""} Google ads` : "Google not read"}`);
        return { rival, site, meta, google };
      }),
  );

  const ads = [];
  const facts = {};
  const sites = {};
  const homes = {};
  const copies = [];
  const videoCopies = [];

  for (const f of found) {
    const { rival } = f;
    if (f.site.text) sites[rival.id] = f.site.text;
    if (f.site.html) homes[rival.id] = f.site.html;
    const unread = [];
    if (!f.meta.read) unread.push("meta");
    if (!f.google.read) unread.push("google");
    facts[rival.id] = {
      meta: f.meta.total,
      google: f.google.total,
      googleMore: f.google.more,
      tracking: f.site.tags,
      metaUrl: f.meta.url,
      googleUrl: f.google.host ? googleDomainUrl(f.google.host) : null,
      unread,
    };

    let storedVideos = 0;
    f.meta.ads.forEach((m, i) => {
      const ad = metaRivalAd(m, rival, i + 1, now);
      const picture = ad.image;
      const video = ad.video;
      // The library's links stop working within hours: an ad keeps only what was copied.
      ad.image = null;
      ad.video = null;
      ads.push(ad);
      if (picture) copies.push(async () => void (ad.image = await keep(c.dir, picture, ad.id, "image")));
      if (video && storedVideos < (c.videos ?? STORED_VIDEOS_PER_RIVAL)) {
        storedVideos++;
        videoCopies.push(async () => {
          if (left(c) > 45_000) ad.video = await keep(c.dir, video, ad.id, "video");
        });
      }
    });

    f.google.ads.forEach((g, i) => {
      const ad = googleRivalAd(g, rival, i + 1, f.google.host, null, now);
      ads.push(ad);
      if (g.format === "video" && g.previewUrl) {
        copies.push(async () => {
          ad.youtubeId = await youtubeIdOf(g.previewUrl);
          if (ad.youtubeId && !ad.image) ad.image = `https://i.ytimg.com/vi/${ad.youtubeId}/mqdefault.jpg`;
        });
      } else if (g.image) {
        const original = g.image;
        // Google's preview pictures stay up, so a failed copy keeps the original link.
        copies.push(async () => void (ad.image = (await keep(c.dir, original, ad.id, "image")) ?? original));
      }
    });
  }

  const market = await marketWork;
  let marketVideos = 0;
  market.forEach((m, i) => {
    const ad = metaRivalAd(m, { id: MARKET, name: m.pageName ?? "", website: null }, i + 1, now);
    const picture = ad.image;
    const video = ad.video;
    ad.image = null;
    ad.video = null;
    ads.push(ad);
    if (picture) copies.push(async () => void (ad.image = await keep(c.dir, picture, ad.id, "image")));
    if (video && marketVideos < 3) {
      marketVideos++;
      videoCopies.push(async () => {
        if (left(c) > 45_000) ad.video = await keep(c.dir, video, ad.id, "video");
      });
    }
  });
  if (!c.noMarket) c.log(`  others advertising for "${c.service}" near ${townOf(c.location)}: ${market.length} ads`);

  for (const [id, first] of sameAs) {
    if (facts[first]) facts[id] = { ...facts[first], sameAs: first };
    if (sites[first]) sites[id] = sites[first];
  }

  c.log(`  saving ${copies.length} pictures and up to ${videoCopies.length} videos (the libraries' links expire within hours)`);
  await Promise.all([pool(copies, 8), pool(videoCopies, 2)]);
  // An ad with nothing left to show, and one card per YouTube video (Google lists a video once per campaign).
  const videosSeen = new Set();
  const shown = ads.filter((a) => {
    if (a.youtubeId) {
      const key = `${a.rival}:${a.youtubeId}`;
      if (videosSeen.has(key)) return false;
      videosSeen.add(key);
    }
    return a.image || a.video || a.youtubeId || a.headline || a.body;
  });
  const sheets = await readGoogleAdWords(c, shown);
  const kept = shown.filter((a) => !sheets.has(a.id));
  return { ads: kept, facts, sites, homes };
}
