// ZuSpy's rules for a report: who a business competes with on Google Maps for its service in its town, the ads
// those rivals are running right now on Facebook, Instagram and Google (ads.mjs), what their customers complain about
// in their own Google reviews, and the ad angles and offers that answer it.
//
// Pure rules, ported from Competitor Spy in Zuops: input checks, picking the rivals from the Maps results, the prompt,
// and the checks on what the model writes back. Every ad is one a library shows, every quote a sentence a real reviewer
// wrote (checked here); every count is counted by code, never by the model.
import { adsPromptBlock } from "./ads.mjs";
export * from "./ads.mjs";
export const MAX_RIVALS = 5;
export function spyInput(body) {
    const s = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
    const service = s(body.service, 80);
    const location = s(body.location, 80);
    if (service.length < 3)
        return { error: "Say what you sell, e.g. garage door repair." };
    if (location.length < 2)
        return { error: "Say where, e.g. Phoenix, AZ." };
    const business = s(body.business, 120) || null;
    const placeId = s(body.place_id, 300) || null;
    return { input: { service, location, business, placeId } };
}
const fold = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\b(llc|inc|co|company|corp|the)\b/g, "").trim();
/**
 * The rivals: the first Maps listings (ads left out) that aren't the business itself, with at least a few reviews to
 * read. `items` is the provider's Maps result list.
 */
export function pickRivals(items, self, max = MAX_RIVALS) {
    const out = [];
    const selfName = self.name ? fold(self.name) : "";
    const seen = new Set();
    const organic = (items ?? [])
        .filter((it) => it && it.type === "maps_search" && typeof it.title === "string")
        .sort((a, b) => Number(a.rank_group ?? 0) - Number(b.rank_group ?? 0));
    for (const it of organic) {
        const placeId = typeof it.place_id === "string" ? it.place_id : null;
        const name = String(it.title).trim();
        if (self.placeId && placeId === self.placeId)
            continue;
        if (selfName && fold(name) === selfName)
            continue;
        const key = placeId ?? fold(name);
        if (seen.has(key))
            continue;
        const votes = Number(it.rating?.votes_count ?? 0);
        if (votes < 3)
            continue;
        seen.add(key);
        out.push({
            id: `c${out.length + 1}`,
            name: name.slice(0, 120),
            placeId,
            cid: it.cid ? String(it.cid) : null,
            rating: Number.isFinite(Number(it.rating?.value)) ? Number(it.rating.value) : null,
            reviews: votes || null,
            category: typeof it.category === "string" ? it.category : null,
            website: typeof it.url === "string" && /^https?:\/\//.test(it.url) ? it.url : null,
            address: typeof it.address === "string" ? it.address : null,
            phone: typeof it.phone === "string" ? it.phone : null,
            lat: Number.isFinite(Number(it.latitude)) ? Number(it.latitude) : null,
            lng: Number.isFinite(Number(it.longitude)) ? Number(it.longitude) : null,
            rank: Number(it.rank_group ?? out.length + 1),
        });
        if (out.length >= max)
            break;
    }
    return out;
}
/** A review split into sentences (the quote picker's units). */
export function sentencesOf(text) {
    const clean = text.replace(/\s+/g, " ").trim();
    const parts = clean.match(/[^.!?]+(?:[.!?]+["”’)]*|$)/g) ?? [clean];
    return parts.map((s) => s.trim()).filter((s) => s.length > 1);
}
/** What the model sees: every review numbered, split into sentences, the rival's site in a few lines. */
export function spyPrompt(input, rivals, reviews, sites, spied, market = "") {
    const adsBlock = spied
        ? `

THEIR ADS RIGHT NOW (from Meta's Ad Library and Google's Ads Transparency Center; an ad that has run for months is one that pays):
${adsPromptBlock(rivals, spied.ads, spied.facts)}`
        : "";
    const rivalBlock = rivals
        .map((r) => {
        const own = reviews.filter((x) => x.rival === r.id);
        const lines = own
            .map((x) => `  [${x.id}] ${x.stars}★ ${sentencesOf(x.text).map((s, i) => `(${i}) ${s}`).join(" ")}`)
            .join("\n");
        const site = sites[r.id] ? `  Their website says: ${sites[r.id].slice(0, 900)}` : "  (No website text.)";
        return `${r.id}: ${r.name}: ${r.rating ?? "?"}★ from ${r.reviews ?? "?"} reviews, Google Maps spot ${r.rank}.\n${site}\n  Reviews:\n${lines || "  (none read)"}`;
    })
        .join("\n\n");
    return `You are a sharp local marketing strategist. A business sells "${input.service}" in ${input.location}${input.business ? ` (it is "${input.business}")` : ""}. Below are the businesses that show first on Google Maps for that search, what their websites promise, and their customers' reviews (mostly their worst ones), each split into numbered sentences.

${spied
        ? "First read their ads: what they lead with (offers, prices, guarantees, hooks), which ads have run longest, who isn't advertising at all, and what none of them say. Then find"
        : "Find"} the patterns: what customers of these rivals complain about again and again (late or no-shows, surprise prices, upselling, slow replies, rude staff, messy work, poor communication, work that failed, ...), and what they praise. Then turn the complaints into ads and offers for the business above that promise the opposite, so people who fear those problems pick it.

Rules:
- Themes come from the reviews only. For each theme list EVERY review id that complains about it (ids like "c2-r7").
- Quotes: pick review ids and one sentence index each; never write quote text yourself.
- Ads and offers must not name or attack any rival, must not invent facts about the business (no prices, years, ratings, guarantees it didn't give): where a promise needs the business to back it up, say so in "needs" (e.g. "Only if you really arrive on time").
- Plain words a local customer would use. No hype words (revolutionary, unleash, elevate, game-changer), no emojis.
- In sentences call a business by its name, never by its id ("c1"); ids belong only in the id fields.
- About their ads say only what is listed below. Never guess what an ad costs, how well it does, or who it reaches. When there are no reviews to read, leave "themes" and "praise" empty and build the ads and offers on what their ads leave unsaid.

${rivalBlock}${adsBlock}${market
        ? `

HOW EACH ONE GETS CUSTOMERS (checked by code from their websites, the ad libraries and Google; never contradict it; "unknown" means it couldn't be checked, never that they don't do it):
${market}

What these signs mean for a local business:
- An ad that has run 60+ days pays; one that started this month is a test.
- Many town pages (like /garage-door-repair-mesa) = they rank town by town on Google; a blog kept up does the same, slower.
- Local Services Ads = they pay per lead for Google's screened badge at the very top on phones.
- A pixel or ad tag with no ads in the library = paused, past, or run under another name; never say they're running ads.
- A different phone number on the site than on Google, or a call-tracking tool = they track which ads ring the phone.
- Texting or chat, online booking and financing turn visitors into jobs; what most of them lack is an opening.
- AI assistants blocked = ChatGPT and Perplexity can't read their site when someone asks them for a recommendation.
- A headline or offer that changed since a year ago shows what they learned; say what they moved toward.`
        : ""}

Return JSON only:
{
 "summary": "2-3 sentences: the biggest gap in this market and how to win it",${spied
        ? `
 "their_ads": "2-3 sentences: what their ads lead with, which has run longest, and the gap nobody's ad covers",
`
        : ""}${market
        ? `
 "engines": [{"id": "c1", "engine": "one sentence: how this business gets its customers, built only on what is listed (ads, Local Services Ads, town pages, reviews, tools)"}],`
        : ""}
 "plan": [{"week": 1, "step": "one concrete thing to do, under 30 words, with a number where it helps (how many ads, pages or reviews)", "refs": ["what it builds on: an ad id like c1-m2, a competitor id like c2, or lsa"]}],
 "themes": [{"name": "short name, e.g. No-shows and late arrivals", "review_ids": ["c1-r3"], "quotes": [{"id": "c1-r3", "sentence": 0}], "angle": "one sentence: how the business wins this"}],
 "praise": [{"name": "what rivals get praised for", "review_ids": ["c2-r1"]}],
 "rivals": [{"id": "c1", "complaints": ["2-4 word labels"], "praised_for": ["2-4 word labels"], "promises": "what their website leads with, in under 15 words, or empty"${spied ? `, "ad_angle": "what its ads lead with, in under 12 words, or empty"` : ""}}],
 "ads": [{"theme": "theme name", "headline": "under 40 characters", "primary_text": "2-4 short sentences", "why": "under 16 words", "needs": "what the business must really do for this ad to be honest, or empty"}],
 "offers": [{"offer": "under 60 characters", "why": "under 20 words", "needs": "or empty"}]
}
Give 3-6 themes (most common first), 6 ads (at least one per top theme), 4 offers${market ? ", one engine line per competitor" : ""}, and a 30-day plan of 6-10 steps over weeks 1-4 (week 1: the quickest wins; each step builds on something above, named in refs). A plan step never gives a budget in dollars or what an ad will return (no ROAS, CTR, cost per lead).`;
}
/** Mostly capitals ("THEY NEVER CAME"): a real quote, but it reads as a rant on an ad's research page. */
export function shouting(s) {
    const letters = s.replace(/[^A-Za-z]/g, "");
    return letters.length >= 12 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6;
}
/** A model's text, tidied and kept under `max` characters: cut at a sentence's end (or a word's) never mid-word. */
const words = (v, max) => {
    if (typeof v !== "string")
        return "";
    const t = v.replace(/\s+/g, " ").trim().replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "");
    if (t.length <= max)
        return t;
    const head = t.slice(0, max);
    const end = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
    if (end >= max * 0.6)
        return head.slice(0, end + 1);
    const space = head.lastIndexOf(" ");
    return `${head.slice(0, space > max * 0.6 ? space : max - 1).replace(/[,;:\s]+$/, "")}…`;
};
/** Pulls the first JSON object out of a model's answer. */
export function firstJson(text) {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m)
        return null;
    try {
        return JSON.parse(m[0]);
    }
    catch {
        return null;
    }
}
/**
 * The model's answer made safe: themes counted from the review ids it listed (only ids that exist), quotes rebuilt from
 * the reviews' own sentences, rivals' names never in an ad, empty or broken parts dropped.
 */
export function settleSpyResult(raw, rivals, reviews, spied) {
    if (!raw)
        return null;
    const adIds = new Set((spied?.ads ?? []).map((a) => a.id));
    const byId = new Map(reviews.map((r) => [r.id, r]));
    const rivalById = new Map(rivals.map((r) => [r.id, r]));
    const rivalNames = rivals.map((r) => r.name.toLowerCase()).filter((n) => n.length >= 4);
    const namesRival = (s) => {
        const low = s.toLowerCase();
        return rivalNames.some((n) => low.includes(n));
    };
        const arr = (v) => (Array.isArray(v) ? v : []);
    const ids = (v) => [...new Set(arr(v).map(String).filter((id) => byId.has(id)))];
    const themes = arr(raw.themes)
        .map((t) => {
        const list = ids(t?.review_ids);
        const quotes = [];
        const used = new Set();
        // Its unhappiest customers first: a complaint in a 5-star review reads oddly under a weak spot.
        const picked = arr(t?.quotes).sort((x, y) => (byId.get(String(x?.id))?.stars ?? 9) - (byId.get(String(y?.id))?.stars ?? 9));
        for (const q of picked) {
            const r = byId.get(String(q?.id));
            if (!r || used.has(r.id))
                continue;
            const sentence = sentencesOf(r.text)[Number(q?.sentence)];
            if (!sentence || sentence.length < 12 || shouting(sentence))
                continue;
            used.add(r.id);
            quotes.push({ rival: r.rival, rivalName: rivalById.get(r.rival)?.name ?? "", stars: r.stars, text: sentence.slice(0, 280) });
            if (quotes.length >= 3)
                break;
        }
        return {
            name: words(t?.name, 60),
            count: list.length,
            rivals: [...new Set(list.map((id) => byId.get(id).rival))],
            quotes,
            angle: words(t?.angle, 220),
        };
    })
        .filter((t) => t.name && t.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    const praise = arr(raw.praise)
        .map((p) => ({ name: words(p?.name, 60), count: ids(p?.review_ids).length }))
        .filter((p) => p.name && p.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    const notes = new Map(arr(raw.rivals).map((r) => [String(r?.id), r]));
    const rivalsView = rivals.map((r) => {
        const n = notes.get(r.id);
        const own = reviews.filter((x) => x.rival === r.id);
        return {
            ...r,
            read: own.length,
            low: own.filter((x) => x.stars <= 3).length,
            complaints: arr(n?.complaints).map((c) => words(c, 40)).filter(Boolean).slice(0, 4),
            praisedFor: arr(n?.praised_for).map((c) => words(c, 40)).filter(Boolean).slice(0, 4),
            promises: words(n?.promises, 140),
            ...(spied ? { adFacts: spied.facts[r.id], adAngle: words(n?.ad_angle, 120) } : {}),
        };
    });
    const ads = arr(raw.ads)
        .map((a) => ({
        theme: words(a?.theme, 60),
        headline: words(a?.headline, 60),
        primaryText: words(a?.primary_text, 500),
        why: words(a?.why, 160),
        needs: words(a?.needs, 160),
    }))
        .filter((a) => a.headline && a.primaryText && !namesRival(`${a.headline} ${a.primaryText}`))
        .slice(0, 8);
    const offers = arr(raw.offers)
        .map((o) => ({ offer: words(o?.offer, 90), why: words(o?.why, 160), needs: words(o?.needs, 160) }))
        .filter((o) => o.offer && !namesRival(o.offer))
        .slice(0, 6);
    const summary = words(raw.summary, 600);
    const rivalAds = [...(spied?.ads ?? [])].sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
    if (!themes.length && !ads.length && !rivalAds.length)
        return null;
    const rivalIds = new Set(rivals.map((r) => r.id));
    const engineOf = new Map(arr(raw.engines).map((e) => [String(e?.id), words(e?.engine, 260)]).filter(([id, text]) => rivalIds.has(id) && text));
    for (const r of rivalsView)
        if (engineOf.has(r.id))
            r.engine = engineOf.get(r.id);
    const refOk = (x) => adIds.has(x) || rivalIds.has(x) || x === "lsa";
    // A step that promises money (a budget, what an ad returns) is dropped: nobody outside a company can know it.
    const promisesMoney = /\$\s?\d[\d,.]*\s*k?\s*(?:\/|a|per)\s*(?:day|week|month|mo)\b|budget of\s*\$|\bROAS\b|\bCTR\b|\bCPC\b|\bCPL\b|cost per (?:lead|click)/i;
    const plan = arr(raw.plan)
        .map((p) => ({ week: Math.min(4, Math.max(1, Math.round(Number(p?.week)) || 1)), step: words(p?.step, 280), refs: [...new Set(arr(p?.refs).map(String).filter(refOk))].slice(0, 4) }))
        .filter((p) => p.step && !promisesMoney.test(p.step))
        .sort((a, b) => a.week - b.week)
        .slice(0, 10);
    const adMoves = arr(raw.ad_moves)
        .map((m) => ({ move: words(m?.move, 140), adId: adIds.has(String(m?.ad_id)) ? String(m.ad_id) : null }))
        .filter((m) => m.move && !/\$\s?\d|\bROAS\b|\bCTR\b/i.test(m.move))
        .slice(0, 3);
    return {
        summary,
        themes,
        praise,
        rivals: rivalsView,
        ads,
        offers,
        readReviews: reviews.length,
        lowReviews: reviews.filter((r) => r.stars <= 3).length,
        plan,
        ...(spied ? { rivalAds, theirAds: words(raw.their_ads, 600).replace(/\s*\((?:c\d(?:-[mg]\d+)?(?:,\s*)?)+\)/g, ""), adMoves } : {}),
    };
}
