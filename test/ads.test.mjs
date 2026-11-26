import { test } from "node:test";
import { ok as assert, deepStrictEqual as assertEquals } from "node:assert/strict";
import { adIsRivals, adsPromptBlock, adTotals, googleAdsFromItems, googleRivalAd, inTrade, metaAdsFromHtml, metaRivalAd, metaSearchUrl, pickGoogleAds, pickMarketAds, townOf, pickMetaAds, searchName, siteHost, trackingTags, youtubeIdFrom, } from "../src/rules/ads.mjs";
import { settleSpyResult, spyPrompt } from "../src/rules/spy.mjs";
const NOW = Date.parse("2026-11-18T12:00:00Z");
const DAY = 86_400_000;
const secs = (daysAgo) => Math.floor((NOW - daysAgo * DAY) / 1000);
function node(id, page, snapshot = {}, top = {}) {
    return {
        ad_archive_id: id,
        page_id: "900",
        page_name: page,
        start_date: secs(30),
        is_active: true,
        collation_count: 1,
        snapshot: {
            page_name: page,
            display_format: "IMAGE",
            title: "Same-day repair",
            body: { text: "Broken spring? We come today." },
            cta_text: "Book now",
            link_url: "https://www.hartleydoors.com/book",
            images: [{ original_image_url: `https://scontent.test/${id}.jpg?x=1` }],
            videos: [],
            cards: [],
            page_categories: ["Garage Door Service"],
            ...snapshot,
        },
        ...top,
    };
}
const page = (...nodes) => `<html><script type="application/json" data-sjs>${JSON.stringify({ require: [[{ edges: nodes.map((n) => ({ node: n })) }]] })}</script></html>`;
const rival = { id: "c1", name: "Hartley Garage Doors", website: "https://hartleydoors.com/" };
test("a rival's own domain; shared hosts say nothing", () => {
    assertEquals(siteHost("https://www.HartleyDoors.com/phoenix"), "hartleydoors.com");
    assertEquals(siteHost("hartleydoors.com"), "hartleydoors.com");
    assertEquals(siteHost("https://www.facebook.com/hartley"), null);
    assertEquals(siteHost("https://hartley.business.site"), null);
    assertEquals(siteHost(null), null);
});
test("the name typed into the library drops a Maps name's tail", () => {
    assertEquals(searchName("Hartley Garage Doors | Repair & Installation"), "Hartley Garage Doors");
    assertEquals(searchName("Hartley Garage Doors - Phoenix"), "Hartley Garage Doors");
    const url = new URL(metaSearchUrl("Hartley Garage Doors"));
    assertEquals(url.searchParams.get("q"), '"Hartley Garage Doors"');
    assertEquals(url.searchParams.get("media_type"), "all");
    assertEquals(url.searchParams.get("active_status"), "active");
});
test("whose ad it is: the landing domain decides, a franchise's other locations never count", () => {
    assert(adIsRivals({ pageName: "Anything", linkUrl: "https://book.hartleydoors.com/x" }, rival));
    assert(!adIsRivals({ pageName: "Hartley Garage Doors of Fort Wayne", linkUrl: "https://hartleydoorsfortwayne.com/" }, rival));
    // The page is named exactly as the rival: its ads may land on a booking site.
    assert(adIsRivals({ pageName: "Hartley Garage Doors", linkUrl: "https://book.schedulesite.com/hartley" }, rival));
    // No landing page on the ad: the page's name has to be the rival's.
    assert(adIsRivals({ pageName: "Hartley Garage Doors LLC", linkUrl: null }, rival));
    assert(adIsRivals({ pageName: "Hartley Garage Doors Phoenix", linkUrl: "https://www.facebook.com/x" }, rival));
    assert(!adIsRivals({ pageName: "Garage Doors", linkUrl: null }, rival));
    // A rival with no site of its own: only the exact name.
    const bare = { ...rival, website: null };
    assert(adIsRivals({ pageName: "Hartley Garage Doors", linkUrl: null }, bare));
    assert(!adIsRivals({ pageName: "Hartley Garage Doors Phoenix", linkUrl: null }, bare));
});
test("a search page: the rival's ads only, one per creative, job posts out, videos with their cover", () => {
    const html = page(node("1000000001", "Hartley Garage Doors", {}, { start_date: secs(200) }), node("1000000002", "Hartley Garage Doors", { images: [{ original_image_url: "https://scontent.test/1000000001.jpg?y=2" }] }), node("1000000003", "Hartley Garage Doors", { title: "Now hiring technicians", cta_text: "Apply now" }), node("1000000004", "Other Doors of Fort Wayne", { link_url: "https://otherdoors.com/" }), node("1000000005", "Hartley Garage Doors", {
        display_format: "VIDEO",
        images: [],
        videos: [{ video_hd_url: "https://video.test/a.mp4?z=1", video_preview_image_url: "https://scontent.test/cover.jpg" }],
    }, { start_date: secs(90) }));
    const all = metaAdsFromHtml(html);
    assertEquals(all.length, 5);
    assertEquals(all[4].videoUrl, "https://video.test/a.mp4?z=1");
    const picked = pickMetaAds(all, rival);
    assertEquals(picked.total, 3);
    assertEquals(picked.pageId, "900");
    assertEquals(picked.ads.map((a) => a.adId), ["1000000001", "1000000005"]);
    const video = metaRivalAd(picked.ads[1], rival, 2, NOW);
    assertEquals([video.id, video.kind, video.image, video.days, video.host], ["c1-m2", "video", "https://scontent.test/cover.jpg", 90, "hartleydoors.com"]);
    assertEquals(video.sourceUrl, "https://www.facebook.com/ads/library/?id=1000000005");
});
test("others advertising for the same search: not a rival's, not a job post, two a page", () => {
    const other = (id, pageId, page, days, snapshot = {}) => node(id, page, { link_url: `https://${pageId}.test/`, ...snapshot }, { page_id: pageId, start_date: secs(days) });
    const ads = metaAdsFromHtml(page(node("2000000001", "Hartley Garage Doors"), other("2000000002", "p1", "Ortega Overhead Doors", 300), other("2000000003", "p1", "Ortega Overhead Doors", 200), other("2000000004", "p1", "Ortega Overhead Doors", 100), other("2000000005", "p2", "Valley Door Pros", 50, { title: "We're hiring installers" }), other("2000000006", "p3", "Lindqvist Garage Doors", 400), other("2000000007", "p4", "Northwood Wellness", 500, { title: "Support your blood pressure", page_categories: ["Health"], body: { text: "Even in the garage door business." } })));
    assertEquals(pickMarketAds(ads, [rival], "garage door repair").map((a) => a.adId), ["2000000006", "2000000002"]);
    const ad = (pageName, title = "", linkUrl = null) => ({ pageName, pageCategories: [], title, linkUrl });
    assert(inTrade(ad("DS Skin & Lips Medical Spa"), "med spa"));
    assert(inTrade(ad("Perfect Dose Aesthetics", "Med Spa Model Call"), "med spa"));
    assert(!inTrade(ad("Open Space Fitness", "Medals for everyone"), "med spa"));
    assert(inTrade(ad("Apex", "Free estimate", "https://apexgaragedoorpros.com/x"), "garage door repair"));
    assertEquals(townOf("Phoenix,  AZ"), "Phoenix");
});
const gItem = (id, format, firstDaysAgo, lastDaysAgo = 0, extra = {}) => ({
    type: "ads_search",
    creative_id: id,
    advertiser_id: "AR1",
    title: "Hartley Garage Doors LLC",
    url: `https://adstransparency.google.com/advertiser/AR1/creative/${id}?region=US`,
    format,
    preview_image: format === "video" ? { url: null } : { url: `https://tpc.googlesyndication.com/archive/simgad/${id}` },
    preview_url: format === "video" ? "https://displayads-formats.googleusercontent.com/ads/preview/content.js?x=1" : null,
    first_shown: new Date(NOW - firstDaysAgo * DAY).toISOString().replace("T", " ").replace(/\.\d+Z$/, " +00:00"),
    last_shown: new Date(NOW - lastDaysAgo * DAY).toISOString().replace("T", " ").replace(/\.\d+Z$/, " +00:00"),
    ...extra,
});
test("Google's rows: fresh ones only, a mix of kinds, longest running first", () => {
    const ads = googleAdsFromItems([gItem("CR1", "text", 10), gItem("CR2", "text", 300), gItem("CR3", "image", 40), gItem("CR4", "video", 5), gItem("CR5", "text", 400, 90), gItem("CR1", "text", 10), { type: "other" }], NOW);
    assertEquals(ads.map((a) => a.creativeId), ["CR1", "CR2", "CR3", "CR4"]);
    assertEquals(pickGoogleAds(ads, 3).map((a) => a.creativeId), ["CR2", "CR3", "CR4"]);
    const ad = googleRivalAd(ads[3], rival, 1, "hartleydoors.com", "jgZzs1fIsNk", NOW);
    assertEquals([ad.kind, ad.image, ad.days], ["video", "https://i.ytimg.com/vi/jgZzs1fIsNk/mqdefault.jpg", 5]);
});
test("the YouTube video in a Google video ad's preview script", () => {
    assertEquals(youtubeIdFrom(`x("https://i.ytimg.com/vi/jgZzs1fIsNk/hqdefault.jpg")`), "jgZzs1fIsNk");
    assertEquals(youtubeIdFrom(`{"video_id":"xDZbmWZl054"}`), "xDZbmWZl054");
    assertEquals(youtubeIdFrom("nothing here"), null);
});
test("ad trackers named in a page's source", () => {
    const html = `<script>fbq('init','1');</script><script src="https://analytics.tiktok.com/i18n/pixel/events.js"></script><script>gtag('config', 'AW-123');</script>`;
    assertEquals(trackingTags(html), ["Meta Pixel", "Google Ads tag", "TikTok Pixel"]);
    assertEquals(trackingTags("<p>Garage doors</p>"), []);
});
const facts = (over = {}) => ({ meta: 2, google: 40, googleMore: true, tracking: ["Meta Pixel"], metaUrl: "m", googleUrl: "g", unread: [], ...over });
test("the model reads their ads' words and what was found, and may only point at ads that exist", () => {
    const rivals = [
        { id: "c1", name: "Hartley Garage Doors", placeId: "p1", cid: null, rating: 4.8, reviews: 90, category: null, website: "https://hartleydoors.com", address: null, lat: null, lng: null, rank: 1 },
        { id: "c2", name: "Quiet Doors", placeId: "p2", cid: null, rating: 4.1, reviews: 12, category: null, website: null, address: null, lat: null, lng: null, rank: 2 },
    ];
    const [picked] = pickMetaAds(metaAdsFromHtml(page(node("1000000001", "Hartley Garage Doors", {}, { start_date: secs(200) }))), rival).ads;
    const ads = [metaRivalAd(picked, rival, 1, NOW)];
    const spied = { ads, facts: { c1: facts(), c2: facts({ meta: 0, google: 0, googleMore: false, tracking: [], unread: ["google"] }) } };
    const block = adsPromptBlock(rivals, ads, spied.facts);
    assert(block.includes("c1: Hartley Garage Doors: Facebook/Instagram: 2 ads running; Google: 40+ ads running; on its site: Meta Pixel"));
    assert(block.includes("[c1-m1] Facebook/Instagram image, running 200 days: Same-day repair | Broken spring? We come today. | (button: Book now)"));
    assert(block.includes("Google: couldn't be read"));
    const input = { service: "garage door repair", location: "Phoenix, AZ", business: null, placeId: null };
    assert(spyPrompt(input, rivals, [], {}, spied).includes("THEIR ADS RIGHT NOW"));
    assert(!spyPrompt(input, rivals, [], {}).includes("THEIR ADS RIGHT NOW"));
    // No reviews at all: the report still stands on their ads.
    const reviews = [];
    const result = settleSpyResult({
        summary: "s",
        their_ads: "They lead with same-day repair.",
        ad_moves: [{ move: "Copy the layout of their longest-running ad", ad_id: "c1-m1" }, { move: "Point at nothing", ad_id: "c9-m9" }, { move: "They spend $5,000 a month", ad_id: "" }],
        rivals: [{ id: "c1", ad_angle: "Same-day repair" }],
    }, rivals, reviews, spied);
    assert(result);
    assertEquals(result.rivalAds?.map((a) => a.id), ["c1-m1"]);
    assertEquals(result.adMoves, [{ move: "Copy the layout of their longest-running ad", adId: "c1-m1" }, { move: "Point at nothing", adId: null }]);
    assertEquals([result.rivals[0].adAngle, result.rivals[0].adFacts?.google, result.rivals[1].adFacts?.unread], ["Same-day repair", 40, ["google"]]);
    assertEquals(adTotals(ads, spied.facts), { meta: 2, google: 40, googleMore: true, advertising: 1, videos: 0, longest: { id: "c1-m1", days: 200, rival: "c1" } });
    // Without ads and without themes there is no report.
    assertEquals(settleSpyResult({ summary: "s" }, rivals, reviews), null);
});

test("trade: a company goes by its trade's other names, and nobody else gets in", async () => {
    const { looksLikeJobPost } = await import("../src/rules/ad-library.mjs");
    const ad = (pageName, title, linkUrl, pageCategories = []) => ({ pageName, title, linkUrl, pageCategories, body: null, cta: null });
    assert(inTrade(ad("Pharo Heating & Cooling, Inc.", "Same-day furnace repair", "https://pharoheating.com/"), "hvac repair"));
    assert(inTrade(ad("Buckeye Air Conditioning", "Tune-up special", null), "hvac repair"));
    assert(inTrade(ad("Ortega Plumbing", "Drain cleaning", null), "plumber"));
    assert(!inTrade(ad("American Mice Control Association", "Protect the areas you can't see", "https://sofyre.com/x", ["Retail company"]), "hvac repair"));
    assert(!inTrade(ad("Wenge Digital", "Find the leads you're missing", "https://thewenge.com/garage-door-marketing-ohio/"), "hvac repair"));
    assert(looksLikeJobPost(ad("Pharo Heating & Cooling", "Careers at Pharo | Pharo Heating & Cooling", "http://pharoheating.com/careers/")));
    assert(!looksLikeJobPost(ad("Pharo Heating & Cooling", "Same-day furnace repair", "https://pharoheating.com/furnace")));
});
