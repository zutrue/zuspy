/**
 * Read the ads out of a Facebook Ad Library search page.
 *
 * A keyword search (facebook.com/ads/library/?q=…&search_type=keyword_unordered)
 * ships its first page of results as JSON inside the page's
 * <script type="application/json"> blocks. Every result carries an
 * `ad_archive_id`, the advertiser page, `start_date` (unix seconds),
 * `collation_count` (how many ads share this creative) and a `snapshot` with
 * the copy and the media. We walk every JSON block for those objects; when a
 * block does not parse we fall back to reading each ad's region of the raw
 * text by its id marker.
 *
 * Pure module: no Deno APIs, so it can be unit-tested anywhere.
 */
const AD_ID_MARKER = /"(?:adArchiveID|ad_archive_id)"\s*:\s*"?(\d{8,})"?/g;
function str(v) {
    if (typeof v === "string") {
        const t = v.trim();
        return t ? t : null;
    }
    if (typeof v === "number" && Number.isFinite(v))
        return String(v);
    return null;
}
function num(v) {
    if (typeof v === "number" && Number.isFinite(v))
        return v;
    if (typeof v === "string" && /^\d+(\.\d+)?$/.test(v.trim()))
        return Number(v);
    return null;
}
/** "{{product.name}}" style placeholders Facebook leaves in dynamic ads. */
const isTemplate = (s) => !!s && /\{\{[^}]+\}\}/.test(s);
function textOf(v) {
    if (typeof v === "string")
        return str(v);
    if (v && typeof v === "object") {
        const o = v;
        const markup = o.markup && typeof o.markup === "object" ? o.markup : null;
        return str(o.text) ?? (markup ? str(markup.__html) : null);
    }
    return null;
}
function firstImage(list) {
    if (!Array.isArray(list))
        return null;
    for (const item of list) {
        if (!item || typeof item !== "object")
            continue;
        const o = item;
        const url = str(o.original_image_url) ?? str(o.resized_image_url) ?? str(o.watermarked_resized_image_url);
        if (url && /^https?:\/\//i.test(url))
            return url;
    }
    return null;
}
function hasVideoIn(snapshot) {
    const vids = snapshot.videos;
    if (Array.isArray(vids) && vids.length > 0)
        return true;
    const cards = snapshot.cards;
    if (Array.isArray(cards)) {
        for (const c of cards) {
            if (c && typeof c === "object" && (str(c.video_hd_url) || str(c.video_sd_url)))
                return true;
        }
    }
    return false;
}
/** One search result object (has ad_archive_id + snapshot) → LibraryAd. */
export function adFromNode(node) {
    const adId = str(node.ad_archive_id ?? node.adArchiveID);
    if (!adId || !/^\d{8,}$/.test(adId))
        return null;
    const snapshot = (node.snapshot && typeof node.snapshot === "object" ? node.snapshot : {});
    const cards = Array.isArray(snapshot.cards) ? snapshot.cards : [];
    const start = num(node.start_date ?? node.startDate);
    const versions = num(node.collation_count ?? node.collationCount);
    const format = str(snapshot.display_format)?.toUpperCase() ?? null;
    let body = textOf(snapshot.body);
    let title = str(snapshot.title);
    if (isTemplate(body) && cards[0])
        body = textOf(cards[0].body) ?? body;
    if (isTemplate(title) && cards[0])
        title = str(cards[0].title) ?? title;
    const imageUrl = firstImage(snapshot.images) ?? firstImage(cards);
    const categories = Array.isArray(snapshot.page_categories) ? snapshot.page_categories : [];
    const likes = num(snapshot.page_like_count);
    return {
        adId,
        pageId: str(node.page_id ?? snapshot.page_id),
        pageName: str(node.page_name ?? snapshot.page_name),
        startedAt: start && start > 1_000_000_000 ? (start < 1e12 ? start * 1000 : start) : null,
        isActive: typeof node.is_active === "boolean" ? node.is_active : (typeof node.isActive === "boolean" ? node.isActive : null),
        versions: versions && versions > 0 ? Math.round(versions) : 1,
        format,
        body: isTemplate(body) ? null : body,
        title: isTemplate(title) ? null : title,
        cta: str(snapshot.cta_text),
        linkUrl: str(snapshot.link_url) ?? (cards[0] ? str(cards[0].link_url) : null),
        imageUrl,
        hasVideo: hasVideoIn(snapshot),
        cardCount: cards.length,
        pageCategories: [...new Set(categories.map(str).filter((c) => !!c))],
        pageLikes: likes,
        // The page's profile picture (usually its logo; the link expires within hours, so it's copied).
        pagePicture: /^https?:\/\//.test(str(snapshot.page_profile_picture_url) ?? "") ? str(snapshot.page_profile_picture_url) : null,
        rank: 0,
    };
}
/** Every <script type="application/json"> body in the page. */
export function jsonScriptBlocks(html) {
    const out = [];
    const re = /<script\b[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
    for (const m of html.matchAll(re)) {
        const body = m[1];
        if (body && (body.includes("ad_archive_id") || body.includes("adArchiveID")))
            out.push(body);
    }
    return out;
}
function walk(value, found, depth = 0) {
    if (depth > 60 || value === null || typeof value !== "object")
        return;
    if (Array.isArray(value)) {
        for (const v of value)
            walk(v, found, depth + 1);
        return;
    }
    const o = value;
    if (("ad_archive_id" in o || "adArchiveID" in o) && o.snapshot && typeof o.snapshot === "object") {
        const ad = adFromNode(o);
        if (ad && !found.has(ad.adId))
            found.set(ad.adId, ad);
    }
    for (const k in o)
        walk(o[k], found, depth + 1);
}
function unescapeJson(raw) {
    try {
        return JSON.parse(`"${raw}"`);
    }
    catch {
        return raw.replace(/\\\//g, "/");
    }
}
/**
 * Fallback for text that is not valid JSON (a cut-off block, a page the
 * scraper rewrote): read each ad's fields from its own region.
 */
export function adsFromRawText(html) {
    const markers = Array.from(html.matchAll(AD_ID_MARKER), (m) => ({ id: m[1], pos: m.index ?? 0 }));
    const out = new Map();
    for (let i = 0; i < markers.length; i++) {
        const { id, pos } = markers[i];
        if (out.has(id))
            continue;
        let end = html.length;
        for (let j = i + 1; j < markers.length; j++) {
            if (markers[j].id !== id) {
                end = markers[j].pos;
                break;
            }
        }
        // Fields before the id (start_date, page_id) sit just ahead of it in some layouts.
        const region = html.slice(Math.max(0, pos - 1500), Math.min(end, pos + 60_000));
        const pick = (re) => {
            const m = region.match(re);
            return m ? unescapeJson(m[1]).trim() || null : null;
        };
        const image = pick(/"original_image_url"\s*:\s*"((?:[^"\\]|\\.)+)"/) ?? pick(/"resized_image_url"\s*:\s*"((?:[^"\\]|\\.)+)"/);
        const start = pick(/"start_date"\s*:\s*"?(\d{9,13})"?/);
        const versions = pick(/"collation_count"\s*:\s*"?(\d+)"?/);
        const active = region.match(/"is_active"\s*:\s*(true|false)/);
        const body = pick(/"body"\s*:\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const title = pick(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        const startNum = start ? Number(start) : null;
        out.set(id, {
            adId: id,
            pageId: pick(/"page_id"\s*:\s*"?(\d+)"?/),
            pageName: pick(/"page_name"\s*:\s*"((?:[^"\\]|\\.)*)"/),
            startedAt: startNum && startNum > 1_000_000_000 ? (startNum < 1e12 ? startNum * 1000 : startNum) : null,
            isActive: active ? active[1] === "true" : null,
            versions: versions ? Math.max(1, Number(versions)) : 1,
            format: pick(/"display_format"\s*:\s*"([A-Z_]+)"/),
            body: isTemplate(body) ? null : body,
            title: isTemplate(title) ? null : title,
            cta: pick(/"cta_text"\s*:\s*"((?:[^"\\]|\\.)*)"/),
            linkUrl: pick(/"link_url"\s*:\s*"((?:[^"\\]|\\.)*)"/),
            imageUrl: image && /^https?:\/\//i.test(image) ? image : null,
            hasVideo: /"video_(?:hd|sd)_url"\s*:\s*"http/.test(region),
            cardCount: 0,
            pageCategories: (region.match(/"page_categories"\s*:\s*\[([^\]]*)\]/)?.[1].match(/"((?:[^"\\]|\\.)*)"/g) ?? [])
                .map((s) => unescapeJson(s.slice(1, -1)).trim())
                .filter(Boolean),
            pageLikes: (() => {
                const likes = pick(/"page_like_count"\s*:\s*(\d+)/);
                return likes ? Number(likes) : null;
            })(),
            rank: 0,
        });
    }
    return [...out.values()];
}
/** Debug: the raw shape of the first ad objects (scalar fields, snapshot keys, parent keys). */
export function debugAdNodes(html, max = 2) {
    const out = [];
    const visit = (value, parent, depth) => {
        if (out.length >= max || depth > 60 || value === null || typeof value !== "object")
            return;
        if (Array.isArray(value)) {
            for (const v of value)
                visit(v, parent, depth + 1);
            return;
        }
        const o = value;
        if ("ad_archive_id" in o && o.snapshot && typeof o.snapshot === "object") {
            const scalars = {};
            for (const [k, v] of Object.entries(o))
                if (v === null || typeof v !== "object")
                    scalars[k] = v;
            const parentScalars = {};
            for (const [k, v] of Object.entries(parent ?? {})) {
                parentScalars[k] = v === null || typeof v !== "object" ? v : Array.isArray(v) ? `[${v.length}]` : "{}";
            }
            out.push({ scalars, snapshotKeys: Object.keys(o.snapshot), parent: parentScalars });
            return;
        }
        for (const k in o)
            visit(o[k], o, depth + 1);
    };
    for (const block of jsonScriptBlocks(html)) {
        try {
            visit(JSON.parse(block), null, 0);
        }
        catch {
            // skip
        }
        if (out.length >= max)
            break;
    }
    return out;
}
/** All ads on a search page, deduplicated by ad id, in page order (`rank` 1, 2, 3 …). */
export function parseAdLibrarySearch(html) {
    const found = new Map();
    let parsedBlocks = 0;
    for (const block of jsonScriptBlocks(html)) {
        try {
            walk(JSON.parse(block), found);
            parsedBlocks++;
        }
        catch {
            // read it as text below
        }
    }
    if (found.size === 0 || parsedBlocks === 0) {
        for (const ad of adsFromRawText(html))
            if (!found.has(ad.adId))
                found.set(ad.adId, ad);
    }
    return [...found.values()].map((ad, i) => ({ ...ad, rank: i + 1 }));
}
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
/**
 * The search URL for one keyword: active image ads in one country. A
 * multi-word keyword is searched as an exact phrase by default: the unordered
 * search matches any of the words ("eye exam free" brought back unrelated
 * health ads). Some phrases come back empty that way ("kitchen remodeling"),
 * so callers retry with `exact = false`.
 *
 * With a `mode`, a page of 30 is 30 ads that have all been running long
 * enough, instead of 30 ads of which a handful have. Without one: most seen
 * first, any age.
 */
export function adLibrarySearchUrl(query, country = "US", exact = true, mode, now = Date.now()) {
    const q = query.trim().replace(/"/g, "");
    const phrase = exact && /\s/.test(q);
    const p = new URLSearchParams({
        active_status: "active",
        ad_type: "all",
        country,
        is_targeted_country: "false",
        media_type: "image",
        q: phrase ? `"${q}"` : q,
        search_type: phrase ? "keyword_exact_phrase" : "keyword_unordered",
    });
    if (mode) {
        p.set("start_date[min]", "");
        p.set("start_date[max]", isoDay(now - mode.startedBeforeDays * DAY_MS));
    }
    p.set("sort_data[mode]", mode?.sort === "relevance" ? "relevancy_monthly_grouped" : "total_impressions");
    p.set("sort_data[direction]", "desc");
    return `https://www.facebook.com/ads/library/?${p.toString()}`;
}
/**
 * Why a search result is not a business ad worth copying, or null when it is.
 * Marketplace listings are a person's for-sale post (a phone photo, the offer
 * only in the caption, "Learn more about this listing on Facebook
 * Marketplace"); a "Profile" page is a person, not a business; catalog
 * (DPA) ads are product photos filled in from a feed.
 */
export function nonAdReason(ad) {
    if (/facebook\.com\/marketplace\//i.test(ad.linkUrl ?? "") || /listing on Facebook Marketplace/i.test(ad.body ?? "")) {
        return "marketplace";
    }
    if (ad.pageCategories.length > 0 && ad.pageCategories.every((c) => /^(profile|person|personal blog)$/i.test(c)))
        return "profile";
    if (ad.format === "DPA")
        return "catalog";
    return null;
}
/** The advertiser's own website host ("kittysupps.com"), or null for Facebook links and none. */
export function landingHost(linkUrl) {
    if (!linkUrl)
        return null;
    try {
        const host = new URL(linkUrl).hostname.toLowerCase().replace(/^(www|m)\./, "");
        if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com|instagram\.com|wa\.me|whatsapp\.com)$/.test(host))
            return null;
        return host;
    }
    catch {
        return null;
    }
}
const RELEVANCE_STOP = new Set([
    "and", "the", "for", "services", "service", "company", "near", "repair", "new", "best", "free", "local", "your", "get",
    "now", "top", "more", "home", "installation", "contractor",
]);
/**
 * How clearly the ad belongs to the searched trade: 3 when the page's name or
 * Facebook category names it ("Westcoast Chem-Dry Carpet Cleaning", "Roofer"),
 * 2 when the headline or landing page does, 1 when only the post text does
 * (a cat supplement ad mentioning the carpet), 0 when nothing does.
 */
export function adRelevance(ad, terms) {
    // Short words ("air", "spa") hide inside others ("repair", "space").
    const words = [...new Set(terms.flatMap((t) => t.toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length >= 4 && !RELEVANCE_STOP.has(w)))];
    if (!words.length)
        return 1;
    // "roofing" matches "Roofer", "roof": compare on a short stem.
    const stems = words.map((w) => w.replace(/(ing|ers|er|s)$/, "").slice(0, Math.max(4, Math.min(w.length, 6))));
    const has = (text) => {
        const t = String(text ?? "").toLowerCase();
        return !!t && stems.some((s) => t.includes(s));
    };
    if (has(ad.pageName) || has(ad.pageCategories.join(" ")))
        return 3;
    if (has(ad.title) || has(landingHost(ad.linkUrl)))
        return 2;
    return has(ad.body) ? 1 : 0;
}
const OFFER_WORDS = /\b(free|off|save|savings|discount|special|deal|limited|financing|starting at|only|bonus|guarantee[ds]?|coupon|promo|rebate|no cost|no money down|per month|\/mo)\b/gi;
/**
 * 0-40 from the ad's own words: a dollar amount, a percentage and offer words
 * ("free", "$500 off", "financing", "starting at") mark an ad that sells a
 * concrete offer rather than a brand.
 */
export function offerSignal(ad) {
    const text = `${ad.title ?? ""} ${ad.body ?? ""}`;
    let pts = 0;
    if (/\$\s?\d/.test(text))
        pts += 15;
    if (/\d+\s?%/.test(text))
        pts += 10;
    const words = new Set((text.match(OFFER_WORDS) ?? []).map((w) => w.toLowerCase()));
    pts += Math.min(15, words.size * 5);
    return Math.min(40, pts);
}
export function adLibraryAdUrl(adId) {
    return `https://www.facebook.com/ads/library/?id=${encodeURIComponent(adId)}`;
}
const DAY_MS = 86_400_000;
export function daysRunning(ad, now = Date.now()) {
    if (!ad.startedAt)
        return null;
    return Math.max(0, Math.floor((now - ad.startedAt) / DAY_MS));
}
/**
 * 0-100 "proven winner" signal from what the Ad Library shows publicly:
 * how long the advertiser has kept paying for the ad (up to 60 points; 90+
 * days is the max) and how many copies of the creative they run (up to 40).
 * Nobody keeps a losing ad running for months or duplicates it across
 * campaigns, so both are the standard tells for a winner.
 *
 * With `rank` (its place on a search sorted by impressions) the three share
 * the 100: days up to 45, copies up to 25, and up to 30 for being among the
 * most-seen ads for the keyword.
 */
export function winnerScore(days, versions, rank = null) {
    const d = Math.max(0, days ?? 0);
    let dayPts;
    if (d < 7)
        dayPts = (d / 7) * 8;
    else if (d < 14)
        dayPts = 8 + ((d - 7) / 7) * 12;
    else if (d < 30)
        dayPts = 20 + ((d - 14) / 16) * 15;
    else if (d < 60)
        dayPts = 35 + ((d - 30) / 30) * 15;
    else if (d < 90)
        dayPts = 50 + ((d - 60) / 30) * 10;
    else
        dayPts = 60;
    const v = Math.max(1, versions || 1);
    const versionPts = v >= 10 ? 40 : v >= 5 ? 30 : v >= 3 ? 20 : v >= 2 ? 10 : 0;
    if (rank == null || rank < 1)
        return Math.round(Math.min(100, dayPts + versionPts));
    const rankPts = rank <= 3 ? 30 : rank <= 8 ? 24 : rank <= 15 ? 16 : rank <= 25 ? 8 : 4;
    return Math.round(Math.min(100, dayPts * 0.75 + versionPts * 0.625 + rankPts));
}
/**
 * Recruiting ads ("Now hiring", an "Apply now" button): their $ and "bonus"
 * read like offers, but they sell a job, not a service.
 */
export function looksLikeJobPost(ad) {
    if (/^apply now$/i.test((ad.cta ?? "").trim()))
        return true;
    const text = `${ad.title ?? ""} ${ad.body ?? ""}`;
    // ZuSpy: "Careers at Pharo" with a link to /careers is recruiting too.
    if (/^\s*careers?\b/i.test(ad.title ?? "") || /\/(careers?|jobs)(\/|$|\?)/i.test(String(ad.linkUrl ?? "")))
        return true;
    return /\b(now hiring|we(?:'|’)?re hiring|we are hiring|hiring for|join our team|sign[- ]on bonus|per hour|\/hr\b)/i.test(text);
}
/** A single still image the image copier can work from. */
export function isCopyableImageAd(ad) {
    if (!ad.imageUrl || ad.hasVideo)
        return false;
    // DPA (catalog) ads are product photos from a feed, not designed ads.
    if (ad.format && !["IMAGE", "DCO", "MULTI_IMAGES"].includes(ad.format))
        return false;
    // A carousel is several pictures; one card on its own is a fragment.
    if (ad.format === "MULTI_IMAGES" && ad.cardCount > 1)
        return false;
    return true;
}
