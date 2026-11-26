// Competitor Spy: the rivals' own ads. Which ads each rival is running right now on Facebook and Instagram (Meta's
// public Ad Library) and on Google (Google's public Ads Transparency Center, through the Maps data provider), plus the
// ad trackers found in their website's source.
//
// Pure rules, ported from Competitor Spy in Zuops: where to look, which ads on a search
// page are really this rival's (a franchise name brings back every location), which to keep, and what the model is
// told about them. Nothing here is written by a model: every ad, date and count is what the two libraries show.
import { adFromNode, adLibraryAdUrl, jsonScriptBlocks, landingHost, looksLikeJobPost, nonAdReason } from "./ad-library.mjs";
export const META_ADS_PER_RIVAL = 8;
/** Ads kept from other businesses advertising for the same search (not one of the Maps rivals). */
export const MARKET_ADS = 12;
/** The "rival" those ads are filed under. */
export const MARKET = "x";
export const GOOGLE_ADS_PER_RIVAL = 8;
/** Videos copied into our storage per rival (the libraries' own links expire within hours). */
export const STORED_VIDEOS_PER_RIVAL = 2;
/** An ad Google last showed longer ago than this isn't "running now". */
const GOOGLE_FRESH_DAYS = 45;
const DAY = 86_400_000;
const fold = (s) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\b(llc|inc|co|company|corp|ltd|the)\b/g, " ").replace(/\s+/g, " ").trim();
/** Hosts that many businesses share: a "website" there says nothing about whose ad it is. */
const SHARED_HOSTS = /(^|\.)(facebook\.com|fb\.com|instagram\.com|yelp\.com|google\.com|goo\.gl|business\.site|linktr\.ee|wixsite\.com|godaddysites\.com|square\.site|weebly\.com|wordpress\.com|blogspot\.com|angi\.com|homeadvisor\.com|thumbtack\.com|nextdoor\.com|yellowpages\.com|bbb\.org|houzz\.com|porch\.com|tiktok\.com|youtube\.com|x\.com|twitter\.com|linkedin\.com)$/;
/** A rival's own domain ("acmedoors.com"), or null for none or a shared host. */
export function siteHost(url) {
    if (!url)
        return null;
    try {
        const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^(www|m)\./, "");
        if (!host.includes(".") || SHARED_HOSTS.test(host))
            return null;
        return host;
    }
    catch {
        return null;
    }
}
const sameSite = (a, b) => a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
/** The name as typed into a library's search: Maps names often carry "| keywords" or "- Town" tails. */
export function searchName(name) {
    return name.split(/\s[|–—]\s|\s-\s/)[0].replace(/["“”]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}
/** Meta's Ad Library: active ads of every kind in the US that mention the name, most seen first. */
export function metaSearchUrl(query, exact = true) {
    const q = query.trim().replace(/"/g, "");
    const phrase = exact && /\s/.test(q);
    const p = new URLSearchParams({
        active_status: "active",
        ad_type: "all",
        country: "US",
        is_targeted_country: "false",
        media_type: "all",
        q: phrase ? `"${q}"` : q,
        search_type: phrase ? "keyword_exact_phrase" : "keyword_unordered",
    });
    p.set("sort_data[mode]", "total_impressions");
    p.set("sort_data[direction]", "desc");
    return `https://www.facebook.com/ads/library/?${p.toString()}`;
}
/** Every ad a Facebook page is running, on Meta's own site. */
export const metaPageUrl = (pageId) => `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&media_type=all&search_type=page&view_all_page_id=${encodeURIComponent(pageId)}`;
/** Every ad a domain is running, on Google's own site. */
export const googleDomainUrl = (host) => `https://adstransparency.google.com/?region=US&domain=${encodeURIComponent(host)}`;
const http = (v) => (typeof v === "string" && /^https?:\/\//i.test(v.trim()) ? v.trim() : null);
/** A search result with its video and the video's cover, which the image copier's reader leaves out. */
function metaAdFromNode(node) {
    const ad = adFromNode(node);
    if (!ad)
        return null;
    const snap = node.snapshot ?? {};
        const media = [...(Array.isArray(snap.videos) ? snap.videos : []), ...(Array.isArray(snap.cards) ? snap.cards : [])];
    let videoUrl = null;
    let poster = null;
    for (const m of media) {
        videoUrl ??= http(m?.video_hd_url) ?? http(m?.video_sd_url);
        poster ??= http(m?.video_preview_image_url);
        if (videoUrl && poster)
            break;
    }
    return { ...ad, videoUrl, poster };
}
/** Every ad on an Ad Library search page, in page order (most seen first). */
export function metaAdsFromHtml(html) {
    const found = new Map();
    const walk = (value, depth) => {
        if (depth > 60 || value === null || typeof value !== "object")
            return;
        if (Array.isArray(value)) {
            for (const v of value)
                walk(v, depth + 1);
            return;
        }
        const o = value;
        if (("ad_archive_id" in o || "adArchiveID" in o) && o.snapshot && typeof o.snapshot === "object") {
            const ad = metaAdFromNode(o);
            if (ad && !found.has(ad.adId))
                found.set(ad.adId, ad);
            return;
        }
        for (const k in o)
            walk(o[k], depth + 1);
    };
    for (const block of jsonScriptBlocks(html)) {
        try {
            walk(JSON.parse(block), 0);
        }
        catch {
            // a cut-off block: its ads are left out
        }
    }
    return [...found.values()].map((ad, i) => ({ ...ad, rank: i + 1 }));
}
/**
 * Is this ad the rival's? Its landing page on the rival's own domain settles it, and so does a page named exactly as
 * the rival (its ads may send people to a booking site or a funnel on another domain). A page whose name only starts
 * with the rival's counts when its ad doesn't land on some other business's domain (a franchise name brings back
 * every location: "Precision Garage Door of Fort Wayne" is not the one in Phoenix).
 */
export function adIsRivals(ad, rival) {
    const host = siteHost(rival.website);
    const adHost = landingHost(ad.linkUrl);
    if (host && adHost && sameSite(host, adHost))
        return true;
    const page = fold(ad.pageName ?? "");
    const name = fold(searchName(rival.name));
    if (!page || !name)
        return false;
    if (page === name)
        return true;
    if (host && adHost)
        return false;
    // "Acme Roofing" on Maps, "Acme Roofing Tampa" on Facebook: only when the rival has a site of its own that this ad
    // doesn't contradict (it has no landing page), and the shared part is a real name, not one word.
    if (!host)
        return false;
    const [short, long] = page.length <= name.length ? [page, name] : [name, page];
    return short.length >= 8 && short.includes(" ") && long.startsWith(`${short} `);
}
/** The rival's ads from a search page: job posts and Marketplace listings out, one per creative, longest running first. */
export function pickMetaAds(ads, rival, max = META_ADS_PER_RIVAL) {
    const own = ads.filter((a) => adIsRivals(a, rival) && !looksLikeJobPost(a) && nonAdReason(a) !== "marketplace");
    const seen = new Set();
    const unique = [];
    for (const a of own) {
        const media = (a.videoUrl ?? a.imageUrl ?? "").split("?")[0].split("/").pop() ?? "";
        // The same words on another cut or size of the creative is the same ad to someone studying it.
        const said = a.title && a.body ? `${a.videoUrl ? "v" : "i"}|${a.title}|${a.body.slice(0, 80)}` : "";
        if ((media && seen.has(media)) || (said && seen.has(said)))
            continue;
        if (media)
            seen.add(media);
        if (said)
            seen.add(said);
        unique.push(a);
    }
    // An ad nobody would copy: no picture, no video and no words.
    const usable = unique.filter((a) => a.imageUrl || a.videoUrl || a.poster || a.body || a.title);
    usable.sort((a, b) => (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity) || b.versions - a.versions || a.rank - b.rank);
    // Videos and pictures both, when it runs both: the longest-running of each kind first.
    const videos = usable.filter((a) => a.videoUrl);
    const rest = usable.filter((a) => !a.videoUrl);
    const picked = [];
    while (picked.length < max && (videos.length || rest.length)) {
        if (rest.length)
            picked.push(rest.shift());
        if (picked.length < max && videos.length)
            picked.push(videos.shift());
    }
    picked.sort((a, b) => (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity));
    const pages = own.map((a) => a.pageId).filter((p) => !!p);
    return { ads: picked, total: own.length, pageId: pages[0] ?? null };
}
/** "Phoenix, AZ" -> "Phoenix": the word an ad for that town would carry. */
export const townOf = (location) => location.split(",")[0].replace(/\s+/g, " ").trim();
const TRADE_STOP = new Set(["and", "the", "for", "services", "service", "company", "near", "repair", "repairs", "best", "local", "installation", "contractor", "contractors", "new"]);
/**
 * Is the advertiser in this trade? Every word of the service ("med spa", "garage door repair" without "repair") must
 * start a word of its page name, Facebook category, headline or website. The ad's text alone doesn't count: a
 * supplement ad that mentions the garage isn't a garage door company.
 */
export function inTrade(ad, service) {
    const words = fold(service).split(" ").filter((w) => w.length >= 3 && !TRADE_STOP.has(w));
    if (!words.length)
        return true;
    const about = fold(`${ad.pageName ?? ""} ${ad.pageCategories.join(" ")} ${ad.title ?? ""} ${(landingHost(ad.linkUrl) ?? "").replace(/\.[a-z]+$/, "")}`);
    const said = about.split(" ");
    // A short word has to be the word itself ("spa" is not "space"); a longer one may start a word or sit inside one, the
    // way domains are written ("garagedoorpros").
    // Other words the trade goes by ("Heating & Cooling" is HVAC), each read the same way.
    const forms = (w) => [w, ...(SHORT_FORMS[w] ?? []), ...(SAME_TRADE[w] ?? [])];
    const has = (w) => forms(w).some((f) => said.some((x) => x === f || x === `${f}s`) || (f.length >= 4 && about.includes(f)));
    return words.every(has);
}
const SHORT_FORMS = { med: ["medical", "medspa", "medi"], spa: ["medspa"], ac: ["hvac"], air: ["hvac"] };
/** ZuSpy: the names one trade goes by, so a "Heating & Cooling" company counts for "hvac repair". */
const SAME_TRADE = {
    hvac: ["heating", "cooling", "furnace", "air conditioning", "ac"],
    plumber: ["plumbing"],
    plumbing: ["plumber", "plumbers"],
    roof: ["roofing", "roofer", "roofers"],
    roofing: ["roofer", "roofers"],
    dentist: ["dental", "dentistry"],
    dental: ["dentist", "dentistry"],
    lawyer: ["law", "attorney", "attorneys", "legal"],
    attorney: ["law", "lawyer", "lawyers", "legal"],
    electrician: ["electric", "electrical"],
    landscaping: ["landscape", "landscapers", "lawn"],
    pest: ["exterminator", "exterminating"],
    chiropractor: ["chiropractic"],
};
/**
 * Other businesses advertising for the same search on Facebook and Instagram: from a keyword search for the service and
 * town, the ads of businesses in the trade that aren't a Maps rival's, a job post, a Marketplace listing or a
 * person's; two a page at most, one per wording, the longest running first. These are who else is paying to reach the
 * same customers.
 */
export function pickMarketAds(ads, rivals, service, max = MARKET_ADS) {
    const perPage = new Map();
    const seen = new Set();
    const usable = ads
        .filter((a) => (a.imageUrl || a.videoUrl) && !looksLikeJobPost(a) && nonAdReason(a) === null && inTrade(a, service) && !rivals.some((r) => adIsRivals(a, r)))
        .sort((a, b) => (a.startedAt ?? Infinity) - (b.startedAt ?? Infinity) || a.rank - b.rank);
    const out = [];
    for (const a of usable) {
        const page = a.pageId ?? a.pageName ?? "";
        const media = (a.videoUrl ?? a.imageUrl ?? "").split("?")[0].split("/").pop() ?? "";
        const said = a.title && a.body ? `${page}|${a.title}|${a.body.slice(0, 80)}` : "";
        if (!page || (perPage.get(page) ?? 0) >= 2 || (media && seen.has(media)) || (said && seen.has(said)))
            continue;
        perPage.set(page, (perPage.get(page) ?? 0) + 1);
        if (media)
            seen.add(media);
        if (said)
            seen.add(said);
        out.push(a);
        if (out.length >= max)
            break;
    }
    return out;
}
const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
const daysSince = (ms, now) => (ms ? Math.max(0, Math.floor((now - ms) / DAY)) : null);
const clean = (v, max) => {
    const t = (v ?? "").replace(/\s+/g, " ").trim();
    return t ? t.slice(0, max) : null;
};
export function metaRivalAd(ad, rival, n, now = Date.now()) {
    const carousel = !ad.videoUrl && ad.cardCount > 1;
    return {
        id: `${rival.id}-m${n}`,
        rival: rival.id,
        channel: "meta",
        kind: ad.videoUrl ? "video" : carousel ? "carousel" : ad.imageUrl ? "image" : "text",
        advertiser: clean(ad.pageName, 120) ?? rival.name,
        headline: clean(ad.title, 200),
        body: clean(ad.body, 1200),
        cta: clean(ad.cta, 40),
        host: landingHost(ad.linkUrl),
        link: landingHost(ad.linkUrl) ? ad.linkUrl : null,
        image: ad.videoUrl ? ad.poster ?? ad.imageUrl : ad.imageUrl,
        video: ad.videoUrl,
        youtubeId: null,
        startedAt: iso(ad.startedAt),
        days: daysSince(ad.startedAt, now),
        versions: ad.versions,
        cards: carousel ? ad.cardCount : 0,
        sourceUrl: adLibraryAdUrl(ad.adId),
    };
}
const stamp = (v) => {
    if (typeof v !== "string")
        return null;
    const t = Date.parse(v.replace(" +00:00", "Z").replace(" ", "T"));
    return Number.isFinite(t) ? t : null;
};
/** The provider's Ads Transparency rows as we keep them; ads Google stopped showing weeks ago are left out. */
export function googleAdsFromItems(items, now = Date.now()) {
    const out = [];
    const seen = new Set();
    for (const it of items ?? []) {
        if (!it || it.type !== "ads_search" || typeof it.creative_id !== "string" || seen.has(it.creative_id))
            continue;
        const format = it.format === "image" || it.format === "video" ? it.format : it.format === "text" ? "text" : null;
        const url = http(it.url);
        if (!format || !url)
            continue;
        const lastShown = stamp(it.last_shown);
        if (lastShown && now - lastShown > GOOGLE_FRESH_DAYS * DAY)
            continue;
        seen.add(it.creative_id);
        out.push({
            creativeId: it.creative_id,
            advertiser: String(it.title ?? "").trim().slice(0, 120),
            format,
            image: http(it.preview_image?.url),
            previewUrl: http(it.preview_url),
            firstShown: stamp(it.first_shown),
            lastShown,
            url,
        });
    }
    return out;
}
/** A mix of what it runs on Google (videos, pictures, search ads), the longest running of each first. */
export function pickGoogleAds(ads, max = GOOGLE_ADS_PER_RIVAL) {
    const usable = ads.filter((a) => a.image || (a.format === "video" && a.previewUrl));
    const by = (f) => usable.filter((a) => a.format === f).sort((a, b) => (a.firstShown ?? Infinity) - (b.firstShown ?? Infinity));
    const lanes = [by("image"), by("video"), by("text")];
    const picked = [];
    while (picked.length < max && lanes.some((l) => l.length)) {
        for (const lane of lanes) {
            if (picked.length < max && lane.length)
                picked.push(lane.shift());
        }
    }
    return picked.sort((a, b) => (a.firstShown ?? Infinity) - (b.firstShown ?? Infinity));
}
/** The YouTube video behind a Google video ad's preview script. */
export function youtubeIdFrom(script) {
    const m = script.match(/(?:ytimg\.com\/vi\/|youtube\.com\/(?:embed\/|watch\?v=)|video_id[^A-Za-z0-9_-]{1,12})([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/);
    return m ? m[1] : null;
}
export function googleRivalAd(ad, rival, n, host, youtubeId, now = Date.now()) {
    return {
        id: `${rival.id}-g${n}`,
        rival: rival.id,
        channel: "google",
        kind: ad.format,
        advertiser: ad.advertiser || rival.name,
        headline: null,
        body: null,
        cta: null,
        host,
        image: ad.image ?? (youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg` : null),
        video: null,
        youtubeId,
        startedAt: iso(ad.firstShown),
        days: daysSince(ad.firstShown, now),
        versions: 1,
        cards: 0,
        sourceUrl: ad.url,
    };
}
const TRACKERS = [
    ["Meta Pixel", /connect\.facebook\.net\/[^"']*fbevents|fbq\(\s*['"]init/i],
    ["Google Ads tag", /googleadservices\.com|gtag\(\s*['"]config['"]\s*,\s*['"]AW-|[?&]id=AW-\d/i],
    ["TikTok Pixel", /analytics\.tiktok\.com|ttq\.load\(/i],
    ["Microsoft Ads tag", /bat\.bing\.com/i],
    ["Nextdoor Pixel", /ads\.nextdoor\.com/i],
    ["Snapchat Pixel", /sc-static\.net\/scevent|snaptr\(/i],
    ["Pinterest tag", /s\.pinimg\.com\/ct|pintrk\(/i],
    ["LinkedIn tag", /snap\.licdn\.com/i],
    ["Call tracking", /cdn\.callrail\.com|calltrk|callrail|ctm\.js|calltrackingmetrics/i],
];
/**
 * Ad trackers named in a page's source. Only what is there: a site that loads its tags through a tag manager shows
 * none of them, so an empty list never means "doesn't advertise".
 */
export function trackingTags(html) {
    return TRACKERS.filter(([, re]) => re.test(html)).map(([name]) => name);
}
/** What the model reads about the rivals' ads: each one's words, how long it has run, and what was found where. */
export function adsPromptBlock(rivals, ads, facts) {
    const lines = rivals.map((r) => {
        const f = facts[r.id];
        if (f?.sameAs)
            return `${r.id}: ${r.name}: another listing of ${f.sameAs} (same website); its ads are listed there.`;
        const own = ads.filter((a) => a.rival === r.id);
        const found = f
            ? `${f.unread.includes("meta") ? "Facebook/Instagram: couldn't be read" : `Facebook/Instagram: ${f.meta} ads running`}; ${f.unread.includes("google") ? "Google: couldn't be read" : `Google: ${f.google}${f.googleMore ? "+" : ""} ads running`}${f.tracking.length ? `; on its site: ${f.tracking.join(", ")}` : ""}`
            : "ads not checked";
        // ZuSpy: the longest-running ad of each, worded or not, so the summary names the same one the report's header does.
        const oldest = own.reduce((best, a) => (a.days != null && (!best || a.days > (best.days ?? -1)) ? a : best), null);
        const longest = oldest ? `; longest-running ad: [${oldest.id}] ${oldest.channel === "meta" ? "Facebook/Instagram" : "Google"} ${oldest.kind}, ${oldest.days} days` : "";
        const worded = own
            .filter((a) => a.headline || a.body)
            .slice(0, 6)
            .map((a) => {
            const where = a.channel === "meta" ? "Facebook/Instagram" : "Google";
            const age = a.days != null ? `, running ${a.days} days` : "";
            return `  [${a.id}] ${where} ${a.kind}${age}: ${[a.headline, a.body?.slice(0, 320), a.cta ? `(button: ${a.cta})` : ""].filter(Boolean).join(" | ")}`;
        });
        return `${r.id}: ${r.name}: ${found}${longest}\n${worded.join("\n") || "  (no ad words to read)"}`;
    });
    const others = ads.filter((a) => a.rival === MARKET && (a.headline || a.body)).slice(0, 8);
    const market = others.length
        ? `\n\nOTHER BUSINESSES advertising for this search on Facebook/Instagram (not among the Maps rivals above):\n${others
            .map((a) => `  [${a.id}] ${a.advertiser}, ${a.kind}${a.days != null ? `, running ${a.days} days` : ""}: ${[a.headline, a.body?.slice(0, 260)].filter(Boolean).join(" | ")}`)
            .join("\n")}`
        : "";
    return lines.join("\n") + market;
}
/** Counts for the report's header, from the ads kept and the facts found. */
export function adTotals(ads, facts) {
    const list = Object.values(facts).filter((f) => !f.sameAs);
    // The competitors' own ads; others in the market are extra.
    const own = ads.filter((x) => x.rival !== MARKET);
    const longest = own.reduce((best, a) => (a.days != null && (!best || a.days > (best.days ?? -1)) ? a : best), null);
    return {
        meta: list.reduce((n, f) => n + f.meta, 0),
        google: list.reduce((n, f) => n + f.google, 0),
        googleMore: list.some((f) => f.googleMore),
        advertising: list.filter((f) => f.meta + f.google > 0).length,
        videos: own.filter((a) => a.kind === "video").length,
        longest: longest ? { id: longest.id, days: longest.days, rival: longest.rival } : null,
    };
}
