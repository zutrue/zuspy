// ZuSpy's rules for watching one company: what a check reads (its site's headline, offers, phones and tools, its
// sitemap, job board and Google listing) and how two checks become dated changes (diffSnapshots). Pure rules, ported
// from Competitor Spy's Watching in Zuops. Nothing here is written by a model: every change is something one check saw
// and the one before didn't, and a part that couldn't be read says nothing.
/** Ads kept per library for a watched company (a report keeps 8). */
export const WATCH_ADS_PER_LIBRARY = 24;
/** Pages an ad sends people to that one check reads. */
export const MAX_LANDINGS = 4;
// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const s = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
/** "www.Acme-Doors.com/x" -> "https://acme-doors.com" style website, or null. */
export function cleanWebsite(v) {
    const raw = s(v, 300);
    if (!raw)
        return null;
    try {
        const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
        if (!u.hostname.includes(".") || /\s/.test(u.hostname))
            return null;
        return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname === "/" ? "" : u.pathname.replace(/\/+$/, "")}`;
    }
    catch {
        return null;
    }
}
export const hostOf = (url) => {
    if (!url)
        return null;
    try {
        return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^(www|m)\./, "");
    }
    catch {
        return null;
    }
};
export function watchInput(body) {
    const website = cleanWebsite(body.website);
    let name = s(body.name, 120);
    if (!name && website)
        name = hostOf(website) ?? "";
    if (name.length < 2)
        return { error: "Type the company's name or its website." };
    if (body.website && !website)
        return { error: "That website doesn't look right. Try it like halvorsendoors.com." };
    return { input: { name, website, placeId: s(body.place_id, 300) || null, town: s(body.town, 80) || null, service: s(body.service, 80) || null } };
}
export const TOOL_GROUP_LABEL = {
    ads: "Ad tracking",
    calls: "Call tracking",
    chat: "Chat and texting",
    booking: "Booking and job software",
    reviews: "Review tools",
    builder: "Site and landing pages",
    analytics: "Visitor tracking",
    email: "Email and CRM",
    financing: "Financing",
};
const TOOLS = [
    ["Meta Pixel", "ads", /connect\.facebook\.net\/[^"']*fbevents|fbq\(\s*['"]init/i],
    ["Google Ads tag", "ads", /googleadservices\.com|gtag\(\s*['"]config['"]\s*,\s*['"]AW-|[?&]id=AW-\d/i],
    ["TikTok Pixel", "ads", /analytics\.tiktok\.com|ttq\.load\(/i],
    ["Microsoft Ads tag", "ads", /bat\.bing\.com/i],
    ["Nextdoor Pixel", "ads", /ads\.nextdoor\.com/i],
    ["Snapchat Pixel", "ads", /sc-static\.net\/scevent|snaptr\(/i],
    ["Pinterest tag", "ads", /s\.pinimg\.com\/ct|pintrk\(/i],
    ["LinkedIn tag", "ads", /snap\.licdn\.com/i],
    ["CallRail", "calls", /cdn\.callrail\.com|calltrk\.com|callrail/i],
    ["CallTrackingMetrics", "calls", /tctm\.co|calltrackingmetrics/i],
    ["Invoca", "calls", /solutions\.invocacdn\.com|invoca\.net/i],
    ["WhatConverts", "calls", /whatconverts\.com|ksrndkehqnwntyxlhgto\.com/i],
    ["Podium", "chat", /connect\.podium\.com|podium-widget/i],
    ["Intercom", "chat", /widget\.intercom\.io|js\.intercomcdn\.com/i],
    ["Drift", "chat", /js\.driftt\.com/i],
    ["Tawk.to", "chat", /embed\.tawk\.to/i],
    ["LiveChat", "chat", /cdn\.livechatinc\.com/i],
    ["Tidio", "chat", /code\.tidio\.co/i],
    ["Smith.ai", "chat", /smith\.ai\/chat|app\.smith\.ai/i],
    ["ServiceTitan", "booking", /servicetitan\.com|static\.servicetitan/i],
    ["Housecall Pro", "booking", /housecallpro\.com/i],
    ["Jobber", "booking", /clienthub\.getjobber\.com|getjobber\.com/i],
    ["Workiz", "booking", /workiz\.com/i],
    ["Calendly", "booking", /assets\.calendly\.com|calendly\.com\//i],
    ["Schedule Engine", "booking", /scheduleengine\.net/i],
    ["Birdeye", "reviews", /birdeye\.com/i],
    ["NiceJob", "reviews", /nicejob\.co/i],
    ["Trustpilot", "reviews", /widget\.trustpilot\.com/i],
    ["Elfsight", "reviews", /apps\.elfsight\.com/i],
    ["Unbounce", "builder", /unbounce\.com/i],
    ["ClickFunnels", "builder", /clickfunnels\.com/i],
    ["HighLevel", "builder", /leadconnectorhq\.com|msgsndr\.com/i],
    ["Leadpages", "builder", /leadpages\.(net|co)|lpages\.co/i],
    ["Webflow", "builder", /assets\.website-files\.com|cdn\.prod\.website-files\.com|data-wf-site/i],
    ["Wix", "builder", /static\.wixstatic\.com|wix-code/i],
    ["Squarespace", "builder", /static1\.squarespace\.com|squarespace-cdn/i],
    ["WordPress", "builder", /\/wp-content\/|\/wp-includes\//i],
    ["Shopify", "builder", /cdn\.shopify\.com/i],
    ["Google Tag Manager", "analytics", /googletagmanager\.com\/gtm\.js|['"]GTM-[A-Z0-9]{4,}/],
    ["Google Analytics", "analytics", /googletagmanager\.com\/gtag\/js\?id=G-|google-analytics\.com\/analytics\.js/i],
    ["Hotjar", "analytics", /static\.hotjar\.com/i],
    ["Microsoft Clarity", "analytics", /clarity\.ms\/tag/i],
    ["Crazy Egg", "analytics", /script\.crazyegg\.com/i],
    ["Optimizely", "analytics", /cdn\.optimizely\.com/i],
    ["VWO", "analytics", /visualwebsiteoptimizer\.com/i],
    ["HubSpot", "email", /js\.hs-scripts\.com|js\.hsforms\.net/i],
    ["Klaviyo", "email", /static\.klaviyo\.com|klaviyo\.com\/onsite/i],
    ["Mailchimp", "email", /chimpstatic\.com|list-manage\.com/i],
    ["ActiveCampaign", "email", /trackcmp\.net|activehosted\.com/i],
    ["Salesforce", "email", /pardot\.com|force\.com\/|salesforce\.com\/servlet/i],
    ["GreenSky", "financing", /greensky/i],
    ["Synchrony", "financing", /synchrony|mysynchrony/i],
    ["Wisetack", "financing", /wisetack/i],
    ["Affirm", "financing", /cdn1\.affirm\.com|affirm\.com\/js/i],
    ["Hearth", "financing", /gethearth\.com/i],
    ["Service Finance", "financing", /svcfin\.com|service finance company/i],
];
export function siteTools(html) {
    return TOOLS.filter(([, , re]) => re.test(html)).map(([name, group]) => ({ name, group }));
}
const ENTITIES = { amp: "&", nbsp: " ", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", ndash: "–", mdash: "—", hellip: "…", lt: "<", gt: ">" };
export function decodeText(text) {
    return text
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16) || 32))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d) || 32))
        .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? " ")
        .replace(/\s+/g, " ")
        .trim();
}
const strip = (html) => decodeText(html.replace(/<[^>]+>/g, " "));
/** The page's words a visitor reads, one chunk per block (heading, paragraph, button, list item). */
export function pageChunks(html) {
    const body = html
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<(head|script|style|noscript|svg|template|select|option)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/a|\/button|\/section|\/td|\/span|\/label)[^>]*>/gi, "\n");
    return body
        .split("\n")
        .map(strip)
        .filter((c) => c.length > 1);
}
const OFFER = /(\d{1,3}\s?%\s?off|\$\s?\d[\d,]*\s?(off|discount|savings)|save (up to )?\$?\d|0\s?%\s?(interest|apr|financing|down)|no (interest|payments?|money down)|free (in-home |on-site )?(estimates?|quotes?|inspection|consultation|installation|install|furniture moving|second opinion|service call|delivery|trip charge)|buy (one|1),? get|bogo|as low as \$\s?\d|\$\s?\d[\d,]*\s?(\/|per |a )?(mo|month)|or it'?s free|price match|lowest price guarantee|money[- ]back|(limited[- ]time|special) offer|\bsale\b.{0,40}(ends|off)|same[- ]day|next[- ]day)/i;
const foldOffer = (t) => t.toLowerCase().replace(/[^a-z0-9%$]+/g, " ").trim();
/** The offers a page shows: the short lines with a discount, a price, financing or a "free" promise in them. */
export function offersIn(chunks, max = 6) {
    const out = [];
    const seen = new Set();
    for (const chunk of chunks) {
        // A long paragraph: only the sentence that carries the offer.
        const parts = chunk.length > 150 ? (chunk.match(/[^.!?]+[.!?]*/g) ?? [chunk]) : [chunk];
        for (const part of parts) {
            const text = part.trim();
            if (text.length < 8 || text.length > 150 || !OFFER.test(text))
                continue;
            // A sentence that lists what's always free ("free estimates, free furniture moving and a warranty") is a
            // description, not an offer: without a number in it, only a short line counts.
            if (text.length > 70 && !/\d/.test(text))
                continue;
            // A button that only asks for the free quote every company gives isn't this month's offer.
            if (text.length < 45 && /^(request|get|schedule|book|claim|start)\b.*\bfree (in-home |on-site )?(estimates?|quotes?|consultation)\W*$/i.test(text))
                continue;
            // Legal small print and cookie lines aren't offers.
            if (/consent|cookies?|privacy|msg & data|terms and conditions|not available in all areas|qualified buyers|approved credit/i.test(text))
                continue;
            const key = foldOffer(text);
            if (seen.has(key))
                continue;
            seen.add(key);
            out.push(text);
            if (out.length >= max)
                return out;
        }
    }
    return out;
}
/** US phone numbers on a page as ten digits: tel: links first, then numbers written out. */
export function phonesIn(html, max = 6) {
    const out = [];
    const add = (raw) => {
        let d = raw.replace(/\D/g, "");
        if (d.length === 11 && d.startsWith("1"))
            d = d.slice(1);
        if (d.length !== 10 || /^[01]/.test(d) || /^(\d)\1{9}$/.test(d))
            return;
        if (!out.includes(d) && out.length < max)
            out.push(d);
    };
    for (const m of html.matchAll(/href=["']tel:([^"']+)/gi))
        add(m[1]);
    const text = strip(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " "));
    for (const m of text.matchAll(/(?:^|[^\d.])(\(?\d{3}\)?[\s.-]{1,2}\d{3}[\s.-]\d{4})(?!\d)/g))
        add(m[1]);
    return out;
}
export const prettyPhone = (d) => (d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : d);
const meta = (html, name) => {
    const tag = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*>`, "i"))?.[0];
    return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
};
export function siteFacts(html) {
    const title = decodeText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").slice(0, 200) || null;
    const description = decodeText(meta(html, "description") ?? meta(html, "og:description") ?? "").slice(0, 300) || null;
    const headings = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => strip(m[1])).filter((h) => h.length > 2);
    const boxes = (part) => [...part.matchAll(/<(input|textarea|select)\b[^>]*>/gi)].filter((m) => !/type=["']?(hidden|submit|button|checkbox|radio|search)/i.test(m[0])).length;
    // The first real form on the page (a page often repeats its form further down); without form tags, every box.
    const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map((m) => boxes(m[0])).filter((n) => n >= 2);
    const fields = forms[0] ?? boxes(html);
    return {
        title,
        description,
        headline: headings[0]?.slice(0, 200) ?? null,
        offers: offersIn(pageChunks(html)),
        phones: phonesIn(html),
        tools: siteTools(html),
        formFields: fields,
    };
}
export const MAX_PATHS = 800;
export const sitemapLocs = (xml) => [...xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/gi)].map((m) => m[1].trim());
export const isSitemapIndex = (xml) => /<sitemapindex[\s>]/i.test(xml);
export function pageFacts(urls) {
    const paths = new Set();
    for (const u of urls) {
        try {
            const p = new URL(u).pathname.replace(/\/+$/, "") || "/";
            paths.add(p.toLowerCase());
        }
        catch {
            /* not a URL */
        }
    }
    if (!paths.size)
        return null;
    const count = new Map();
    for (const p of paths) {
        const parts = p.split("/").filter(Boolean);
        const family = parts.length > 1 ? `/${parts[0]}` : "(top pages)";
        count.set(family, (count.get(family) ?? 0) + 1);
    }
    const families = [...count].map(([family, pages]) => ({ family, pages })).sort((a, b) => b.pages - a.pages || Number(a.family.startsWith("(")) - Number(b.family.startsWith("("))).slice(0, 8);
    return { total: paths.size, families, paths: [...paths].sort().slice(0, MAX_PATHS) };
}
/** The careers page a home page links to. */
export function careersLink(html, base) {
    for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
        const href = m[1];
        const words = strip(m[2]);
        if (!/careers?|jobs|join[- ]our[- ]team|we'?re[- ]hiring|employment/i.test(`${href} ${words}`))
            continue;
        if (/^(mailto|tel|javascript):/i.test(href))
            continue;
        try {
            return new URL(href, base).toString();
        }
        catch {
            /* next */
        }
    }
    return null;
}
/** A public job board named in a page's source. */
export function jobBoardIn(html) {
    const gh = html.match(/(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board(?:\/js)?\?for=)?([a-z0-9_-]{2,60})/i);
    if (gh && !/^(embed|v1)$/i.test(gh[1]))
        return { ats: "greenhouse", slug: gh[1].toLowerCase() };
    const lever = html.match(/jobs\.lever\.co\/([a-z0-9_-]{2,60})/i);
    if (lever)
        return { ats: "lever", slug: lever[1].toLowerCase() };
    const ashby = html.match(/jobs\.ashbyhq\.com\/([a-z0-9_.-]{2,60})/i);
    if (ashby)
        return { ats: "ashby", slug: ashby[1] };
    return null;
}
export const jobBoardApi = (b) => b.ats === "greenhouse"
    ? `https://boards-api.greenhouse.io/v1/boards/${b.slug}/jobs`
    : b.ats === "lever"
        ? `https://api.lever.co/v0/postings/${b.slug}?mode=json`
        : `https://api.ashbyhq.com/posting-api/job-board/${b.slug}`;
const day = (v) => {
    const t = typeof v === "number" ? v : typeof v === "string" ? Date.parse(v) : NaN;
    return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
};
/** A board's answer as roles, newest first. Titles and places only: never a recruiter's or anyone's name. */
export function jobFacts(board, json, max = 40) {
        const list = board.ats === "lever" ? (Array.isArray(json) ? json : []) : Array.isArray(json?.jobs) ? json.jobs : [];
    const roles = list
        .map((j) => ({
        title: s(j?.title ?? j?.text, 140),
        location: s(typeof j?.location === "string" ? j.location : j?.location?.name ?? j?.categories?.location, 80) || null,
        posted: day(j?.first_published ?? j?.updated_at ?? j?.createdAt ?? j?.publishedAt),
        url: typeof (j?.absolute_url ?? j?.hostedUrl ?? j?.jobUrl) === "string" ? String(j.absolute_url ?? j.hostedUrl ?? j.jobUrl).slice(0, 400) : null,
    }))
        .filter((r) => r.title);
    if (!list.length && !Array.isArray(json) && !Array.isArray(json?.jobs))
        return null;
    roles.sort((a, b) => (b.posted ?? "").localeCompare(a.posted ?? ""));
    return { board: board.ats, total: roles.length, roles: roles.slice(0, max) };
}
/** The same ad in two checks has the same key: its id in the library it came from. */
export function adKey(ad) {
    if (ad.youtubeId)
        return `g:yt:${ad.youtubeId}`;
    const id = ad.sourceUrl.match(/[?&]id=(\d{6,})/)?.[1] ?? ad.sourceUrl.match(/creative\/(CR\d+)/i)?.[1] ?? ad.sourceUrl.match(/(\d{10,})/)?.[1];
    if (id)
        return `${ad.channel === "meta" ? "m" : "g"}:${id}`;
    return `${ad.channel === "meta" ? "m" : "g"}:w:${foldOffer(`${ad.headline ?? ""} ${(ad.body ?? "").slice(0, 80)}`)}`;
}
const TRACKING_PARAM = /^(utm_|fbclid|gclid|gad_|msclkid|ttclid|mc_|_hs|ref$|campaign|adset|ad_id|h_ad_id)/i;
/** Where an ad sends people, without the tracking on the end; null for a link into Facebook itself. */
export function landingUrl(link) {
    if (!link)
        return null;
    try {
        let u = new URL(link);
        if (/^l\.(facebook|instagram)\.com$/.test(u.hostname) && u.searchParams.get("u"))
            u = new URL(u.searchParams.get("u"));
        if (!/^https?:$/.test(u.protocol))
            return null;
        const host = u.hostname.toLowerCase();
        if (/(^|\.)(facebook\.com|fb\.com|fb\.me|messenger\.com|instagram\.com|wa\.me|whatsapp\.com)$/.test(host))
            return null;
        for (const k of [...u.searchParams.keys()])
            if (TRACKING_PARAM.test(k))
                u.searchParams.delete(k);
        const q = u.searchParams.toString();
        return `https://${host}${u.pathname.replace(/\/+$/, "")}${q ? `?${q}` : ""}`;
    }
    catch {
        return null;
    }
}
/** The pages worth reading: where the most ads lead, pages off the company's own home page first. */
export function landingsToRead(ads, website, max = MAX_LANDINGS) {
    const home = website ? (landingUrl(website) ?? "").replace(/^https:\/\/www\./, "https://") : "";
    // "www.x.com/a" and "x.com/a" are one page, but the address is kept as the ad wrote it: some sites only answer on one.
    const count = new Map();
    for (const ad of ads) {
        const url = landingUrl(ad.link);
        const key = url?.replace(/^https:\/\/www\./, "https://");
        if (!url || !key || key === home)
            continue;
        const seen = count.get(key);
        if (seen)
            seen.ads++;
        else
            count.set(key, { url, ads: 1 });
    }
    return [...count.values()].sort((a, b) => b.ads - a.ads).slice(0, max);
}
const CHANNEL = { meta: "Facebook and Instagram", google: "Google" };
const libraryRead = (snap, channel) => !!snap.adFacts && !snap.adFacts.unread.includes(channel);
/** Every ad the library listed is in the snapshot, so one missing next time really stopped. */
const sawAll = (snap, channel) => {
    if (!libraryRead(snap, channel) || !snap.adFacts)
        return false;
    const kept = snap.ads.filter((a) => a.channel === channel).length;
    return channel === "meta" ? snap.adFacts.meta <= kept + 2 : !snap.adFacts.googleMore && snap.adFacts.google <= kept + 2;
};
const adLine = (ad) => (ad.headline ?? ad.body ?? (ad.kind === "video" ? "A video ad" : "An ad")).replace(/\s+/g, " ").slice(0, 140);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const TOOL_WHY = {
    ads: "They can now aim ads at people who visited their site, and count what those ads bring in.",
    calls: "They're measuring which ads make the phone ring, so expect them to move money to what works.",
    chat: "Visitors can now reach them without calling.",
    booking: "Customers can book them without a phone call.",
    reviews: "They're asking customers for reviews in a more organized way.",
    builder: "They're building separate pages for their ads.",
    financing: "They can now sell bigger jobs on monthly payments.",
};
/**
 * What the newer check saw that the one before didn't (and the other way round). A part that couldn't be read in
 * either check says nothing: an unread library is never "they stopped advertising".
 */
export function diffSnapshots(prev, next) {
    const at = next.at;
    const out = [];
    // Ads
    for (const channel of ["meta", "google"]) {
        if (!libraryRead(prev, channel) || !libraryRead(next, channel))
            continue;
        const before = prev.ads.filter((a) => a.channel === channel);
        const after = next.ads.filter((a) => a.channel === channel);
        if (!before.length && after.length) {
            out.push({ at, kind: "ads_started", weight: 3, title: `Started advertising on ${CHANNEL[channel]}`, detail: `${plural(after.length, "ad")} running now.`, why: "They weren't there at the last check. Look at what they lead with.", image: after[0].image, adKey: after[0].key });
            continue;
        }
        if (before.length && !after.length) {
            out.push({ at, kind: "ads_paused", weight: 3, title: `Stopped all ads on ${CHANNEL[channel]}`, detail: `${plural(before.length, "ad")} were running at the last check.`, why: "Either it wasn't paying, or they're between campaigns. Their customers are cheaper to reach this week." });
            continue;
        }
        const had = new Set(before.map((a) => a.key));
        const has = new Set(after.map((a) => a.key));
        // An ad older than the last check that we simply hadn't listed yet isn't news.
        const fresh = after.filter((a) => !had.has(a.key) && (!a.startedAt || a.startedAt > prev.at || sawAll(prev, channel)));
        for (const ad of fresh.slice(0, 8)) {
            out.push({ at: ad.startedAt && ad.startedAt > prev.at ? ad.startedAt : at, kind: "ad_new", weight: 2, title: `New ${ad.kind === "video" ? "video ad" : "ad"} on ${CHANNEL[channel]}`, detail: adLine(ad), image: ad.image, link: ad.sourceUrl, adKey: ad.key });
        }
        if (fresh.length > 8)
            out.push({ at, kind: "ad_new", weight: 2, title: `${fresh.length - 8} more new ads on ${CHANNEL[channel]}`, detail: "They're all in the ads list below." });
        if (sawAll(prev, channel)) {
            const gone = before.filter((a) => !has.has(a.key));
            for (const ad of gone.slice(0, 6)) {
                const long = (ad.days ?? 0) >= 60;
                out.push({ at, kind: "ad_stopped", weight: long ? 2 : 1, title: `Stopped an ad on ${CHANNEL[channel]}${ad.days ? ` after ${plural(ad.days, "day")}` : ""}`, detail: adLine(ad), why: long ? "It ran a long time, so it was probably paying. Watch what replaces it." : null, image: ad.image, adKey: ad.key });
            }
            if (gone.length > 6)
                out.push({ at, kind: "ad_stopped", weight: 1, title: `Stopped ${gone.length - 6} more ads on ${CHANNEL[channel]}` });
        }
    }
    // Website
    if (prev.site && next.site) {
        const a = prev.site;
        const b = next.site;
        if (a.headline && b.headline && foldOffer(a.headline) !== foldOffer(b.headline)) {
            out.push({ at, kind: "headline", weight: 2, title: "Changed the headline on their home page", before: a.headline, after: b.headline, why: "The first words a visitor reads are what they think sells best right now." });
        }
        const hadOffer = new Set(a.offers.map(foldOffer));
        const hasOffer = new Set(b.offers.map(foldOffer));
        // One change however many lines the offer is written across.
        const newOffers = b.offers.filter((o) => !hadOffer.has(foldOffer(o))).slice(0, 4);
        if (newOffers.length) {
            out.push({ at, kind: "offer_new", weight: 3, title: newOffers.length === 1 ? "New offer on their website" : `${newOffers.length} new offers on their website`, detail: newOffers.join("  ·  "), why: "A customer comparing quotes will bring this up." });
        }
        // An offer line can drop off the page for a day; say so only when every old offer is gone or replaced.
        const gone = a.offers.filter((o) => !hasOffer.has(foldOffer(o)));
        if (gone.length && gone.length === a.offers.length) {
            out.push({ at, kind: "offer_gone", weight: 1, title: gone.length === 1 ? "Took an offer off their website" : `Took ${gone.length} offers off their website`, detail: gone.slice(0, 3).join(" · ") });
        }
        for (const phone of b.phones.filter((p) => !a.phones.includes(p)).slice(0, 2)) {
            out.push({ at, kind: "phone_new", weight: 1, title: "New phone number on their website", detail: prettyPhone(phone), why: "A new number is often a tracking number for a new ad channel." });
        }
        const hadTool = new Set(a.tools.map((t) => t.name));
        const hasTool = new Set(b.tools.map((t) => t.name));
        for (const tool of b.tools.filter((t) => !hadTool.has(t.name))) {
            out.push({ at, kind: "tool_new", weight: tool.group === "ads" || tool.group === "calls" ? 2 : 1, title: `Added ${tool.name} to their website`, detail: TOOL_GROUP_LABEL[tool.group], why: TOOL_WHY[tool.group] ?? null });
        }
        for (const tool of a.tools.filter((t) => !hasTool.has(t.name) && t.group === "ads")) {
            out.push({ at, kind: "tool_gone", weight: 1, title: `Removed ${tool.name} from their website`, detail: TOOL_GROUP_LABEL[tool.group] });
        }
    }
    // The pages their ads lead to
    const page = (u) => u.replace(/^https:\/\/www\./, "https://");
    const hadLanding = new Set(prev.landings.map((l) => page(l.url)));
    if (libraryRead(prev, "meta") && libraryRead(next, "meta")) {
        for (const l of next.landings.filter((l) => !hadLanding.has(page(l.url))).slice(0, 3)) {
            out.push({ at, kind: "landing_new", weight: 2, title: "Their ads lead to a new page", detail: l.headline ?? l.title ?? l.url.replace(/^https:\/\//, ""), link: l.url, why: l.own ? null : "It isn't on their main site: a page built only for ad traffic." });
        }
    }
    // Pages
    if (prev.pages && next.pages && prev.pages.total < MAX_PATHS && next.pages.total < MAX_PATHS) {
        const had = new Set(prev.pages.paths);
        const has = new Set(next.pages.paths);
        const added = next.pages.paths.filter((p) => !had.has(p));
        const removed = prev.pages.paths.filter((p) => !has.has(p));
        // A rebuilt site renames everything: that's one change, not hundreds.
        if (added.length && added.length <= Math.max(60, prev.pages.total / 2)) {
            out.push({ at, kind: "pages_new", weight: added.length >= 5 ? 2 : 1, title: `Added ${plural(added.length, "page")} to their website`, detail: added.slice(0, 6).join("  ·  ") + (added.length > 6 ? `  ·  and ${added.length - 6} more` : ""), why: added.length >= 5 ? "A batch of pages at once is a push for more Google searches." : null });
        }
        else if (added.length) {
            out.push({ at, kind: "site_new", weight: 2, title: "Rebuilt much of their website", detail: `${added.length} new pages, ${removed.length} gone.` });
        }
        if (removed.length >= 5 && removed.length <= prev.pages.total / 2 && !added.length) {
            out.push({ at, kind: "pages_gone", weight: 1, title: `Removed ${plural(removed.length, "page")} from their website`, detail: removed.slice(0, 6).join("  ·  ") });
        }
    }
    // Google listing
    if (prev.listing && next.listing) {
        const a = prev.listing;
        const b = next.listing;
        if (a.rating != null && b.rating != null && Math.round(Math.abs(a.rating - b.rating) * 10) >= 1) {
            out.push({ at, kind: "rating", weight: 2, title: `Google rating went ${b.rating > a.rating ? "up" : "down"}`, before: `${a.rating.toFixed(1)} stars`, after: `${b.rating.toFixed(1)} stars` });
        }
        if (a.reviews != null && b.reviews != null) {
            const gained = b.reviews - a.reviews;
            if (gained >= Math.max(5, Math.round(a.reviews * 0.03))) {
                out.push({ at, kind: "reviews", weight: 2, title: `${gained} new Google reviews since the last check`, before: `${a.reviews}`, after: `${b.reviews}`, why: "That's faster than reviews usually come in: they're asking customers for them." });
            }
        }
    }
    // Hiring
    if (prev.jobs && next.jobs) {
        const key = (r) => `${r.title.toLowerCase()}|${(r.location ?? "").toLowerCase()}`;
        const had = new Set(prev.jobs.roles.map(key));
        const added = next.jobs.roles.filter((r) => !had.has(key(r)));
        const marketing = added.filter((r) => /market|brand|seo|advertis|growth|social|content|media buyer|events?/i.test(r.title));
        if (added.length) {
            out.push({
                at,
                kind: "job_new",
                weight: marketing.length ? 2 : 1,
                title: `Posted ${plural(added.length, "new job")}`,
                detail: added.slice(0, 5).map((r) => (r.location ? `${r.title} (${r.location})` : r.title)).join("  ·  ") + (added.length > 5 ? `  ·  and ${added.length - 5} more` : ""),
                why: marketing.length ? "A marketing hire shows which channel they're about to spend more on." : null,
            });
        }
        if (prev.jobs.total >= 3 && next.jobs.total === 0)
            out.push({ at, kind: "jobs_closed", weight: 1, title: "Closed all their job posts", detail: `${prev.jobs.total} were open at the last check.` });
    }
    return out.sort((x, y) => y.weight - x.weight || y.at.localeCompare(x.at));
}
/** Monthly captures of the home page from the web archive, oldest first, as dated changes. */
export function historyFromCaptures(captures) {
    const out = [];
    const sorted = [...captures].sort((a, b) => a.month.localeCompare(b.month));
    for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1];
        const b = sorted[i];
        const at = `${b.month}-01`;
        const top = (c) => c.headline ?? c.title;
        const before = top(a);
        const after = top(b);
        if (before && after && foldOffer(before) !== foldOffer(after)) {
            out.push({ at, kind: "headline", weight: 1, history: true, title: "Changed the headline on their home page", before, after, link: b.link });
        }
        const had = new Set(a.offers.map(foldOffer));
        const fresh = b.offers.filter((o) => !had.has(foldOffer(o)));
        if (fresh.length)
            out.push({ at, kind: "offer_new", weight: 1, history: true, title: "New offer on their website", detail: fresh[0], link: b.link });
    }
    return out;
}
/** Subdomains by the day their first certificate was issued: when a landing-page site or a new market went up. */
export function historyFromCerts(rows, host, sinceIso) {
    const dull = /^(www|mail|webmail|smtp|imap|pop|ftp|cpanel|autodiscover|ns\d*|mx\d*|vpn|remote|dev|staging|stage|test|api|cdn|static|img|assets|email|em\d*|link|click|url\d*|cms\d*|lms|my|portal|admin|login|sso|hr|intranet|commissions|sip|lyncdiscover|enterprise\w*|msoid|_.*)$/i;
    return rows
        .filter((r) => r.name.endsWith(`.${host}`) && r.firstSeen >= sinceIso.slice(0, 10))
        .map((r) => ({ ...r, label: r.name.slice(0, -host.length - 1) }))
        .filter((r) => !r.label.includes(".") && !r.label.includes("*") && !dull.test(r.label))
        .slice(0, 8)
        .map((r) => ({ at: r.firstSeen, kind: "landing_new", weight: 1, history: true, title: `Put up a new site: ${r.name}`, link: `https://${r.name}`, why: /promo|deal|offer|sale|get|go|lp|quote|book/i.test(r.label) ? "A separate address like this is usually built for ad traffic." : null }));
}
export function pulseOf(snap) {
    if (!snap)
        return null;
    const f = snap.adFacts;
    const days = snap.ads.map((a) => a.days ?? 0);
    return {
        metaAds: f && !f.unread.includes("meta") ? f.meta : null,
        googleAds: f && !f.unread.includes("google") ? f.google : null,
        longest: days.length ? Math.max(...days) || null : null,
        offers: snap.site?.offers.length ?? 0,
        jobs: snap.jobs ? snap.jobs.total : null,
        pages: snap.pages ? snap.pages.total : null,
    };
}
/** Every change across the checks, newest first, the same one never twice. */
export function timelineOf(scans, max = 80) {
    const seen = new Set();
    const all = [];
    for (const scan of scans) {
        for (const c of (Array.isArray(scan.changes) ? scan.changes : [])) {
            if (!c || typeof c.title !== "string" || typeof c.at !== "string")
                continue;
            const key = `${c.kind}|${c.at.slice(0, 10)}|${c.title}|${c.detail ?? ""}|${c.after ?? ""}`;
            if (seen.has(key))
                continue;
            seen.add(key);
            all.push(c);
        }
    }
    return all.sort((a, b) => b.at.slice(0, 10).localeCompare(a.at.slice(0, 10)) || b.weight - a.weight).slice(0, max);
}
export function candidatesFrom(items, max = 6) {
    return (items ?? [])
        .filter((it) => it && it.type === "maps_search" && typeof it.title === "string")
        .slice(0, max)
        .map((it) => ({
        name: String(it.title).trim().slice(0, 120),
        place_id: typeof it.place_id === "string" ? it.place_id : null,
        website: typeof it.url === "string" && /^https?:\/\//.test(it.url) ? cleanWebsite(it.url) : null,
        address: typeof it.address === "string" ? it.address.slice(0, 160) : null,
        rating: Number.isFinite(Number(it.rating?.value)) ? Number(it.rating.value) : null,
        reviews: Number(it.rating?.votes_count) || null,
        category: typeof it.category === "string" ? it.category : null,
    }));
}
/** The company's own row among Maps results: by place, then website, then name. */
export function listingFrom(items, who) {
    const list = candidatesFrom(items, 20);
    const fold = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const hit = (who.placeId && list.find((c) => c.place_id === who.placeId)) ||
        (who.host && list.find((c) => hostOf(c.website) === who.host)) ||
        list.find((c) => fold(c.name) === fold(who.name)) ||
        null;
    return hit ? { rating: hit.rating, reviews: hit.reviews, category: hit.category, address: hit.address } : null;
}
