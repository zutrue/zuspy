import { test } from "node:test";
import { ok as assert, deepStrictEqual as assertEquals } from "node:assert/strict";
import { adKey, careersLink, diffSnapshots, historyFromCaptures, historyFromCerts, jobBoardIn, jobFacts, landingsToRead, landingUrl, listingFrom, offersIn, pageChunks, pageFacts, phonesIn, siteFacts, timelineOf, watchInput, } from "../src/rules/watch.mjs";
const HOME = `<html><head><title>Hartley Floors | Free In-Home Estimates</title>
<meta name="description" content="Carpet &amp; tile, installed next day.">
<script src="https://cdn.callrail.com/companies/1/swap.js"></script>
<script>fbq('init', '123');</script></head><body>
<nav><a href="/careers">Careers</a><a href="tel:+18555242312">Call us (855)-524-2312</a></nav>
<h1>Black Friday Flooring Deal!</h1>
<p>Save up to 78% off! Plus, Install by Thanksgiving or it's FREE!</p>
<p>0% interest for up to 12 months with payments as low as $49/Month</p>
<p>I consent to receive marketing calls. Msg &amp; data rates may apply.</p>
<p>*Offer not available in all areas and ends 11/30/2026.</p>
<form><input type="hidden" name="x"><input name="first"><input name="phone"><input name="zip"><input type="submit"></form>
<p>Tucson office: 520.600.4889</p>
</body></html>`;
test("a page's facts: headline, offers without the small print, phones, tools, form boxes", () => {
    const f = siteFacts(HOME);
    assertEquals(f.title, "Hartley Floors | Free In-Home Estimates");
    assertEquals(f.description, "Carpet & tile, installed next day.");
    assertEquals(f.headline, "Black Friday Flooring Deal!");
    assert(f.offers.some((o) => o.includes("78% off")));
    assert(f.offers.some((o) => o.includes("0% interest")));
    assert(!f.offers.some((o) => /consent|not available in all areas/i.test(o)));
    assertEquals(f.phones, ["8555242312", "5206004889"]);
    assertEquals(f.tools.map((t) => t.name).sort(), ["CallRail", "Meta Pixel"]);
    assertEquals(f.formFields, 3);
});
test("an offer inside a long paragraph is only its own sentence", () => {
    const long = `We have been family owned since 1998 and proudly serve the whole valley with care and attention to every detail of the job. Right now you can save $500 off any full roof replacement. Call our office to learn more about our crews, our process and our warranty on every job we do for you.`;
    assertEquals(offersIn(pageChunks(`<p>${long}</p>`)), ["Right now you can save $500 off any full roof replacement."]);
});
test("phone numbers: no version numbers or prices", () => {
    assertEquals(phonesIn("<p>v 1.234.567.8901 costs 1234567890 or call 602-864-3300</p>"), ["6028643300"]);
});
test("adding a company: a name or a website", () => {
    assertEquals(watchInput({ website: "www.ExpressFlooring.com/" }), { input: { name: "expressflooring.com", website: "https://www.expressflooring.com", placeId: null, town: null, service: null } });
    assert("error" in watchInput({ name: "x" }));
    assert("error" in watchInput({ name: "Acme", website: "not a site" }));
});
test("where an ad leads, without the tracking", () => {
    assertEquals(landingUrl("https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.deals.com%2Ffloor-new%2F%3Futm_source%3Dfb%26city%3Dtulsa&h=abc"), "https://www.deals.com/floor-new?city=tulsa");
    assertEquals(landingUrl("https://www.facebook.com/acme"), null);
    assertEquals(landingUrl("https://acme.com/?fbclid=1"), "https://acme.com");
});
const ad = (over) => ({
    id: "c1-m1",
    rival: "c1",
    channel: "meta",
    kind: "image",
    advertiser: "Acme",
    headline: "Save 75%",
    body: null,
    cta: null,
    host: "acme.com",
    image: null,
    video: null,
    youtubeId: null,
    startedAt: "2026-08-13T00:00:00.000Z",
    days: 98,
    versions: 1,
    cards: 0,
    sourceUrl: "https://www.facebook.com/ads/library/?id=1065252569542647",
    key: "m:1065252569542647",
    ...over,
});
test("an ad keeps its name between checks", () => {
    assertEquals(adKey(ad({})), "m:1065252569542647");
    assertEquals(adKey(ad({ channel: "google", sourceUrl: "https://adstransparency.google.com/advertiser/AR1/creative/CR0123456789?region=US" })), "g:CR0123456789");
    assertEquals(adKey(ad({ channel: "google", youtubeId: "GOmZnwDr7fs", sourceUrl: "x" })), "g:yt:GOmZnwDr7fs");
});
test("landing pages to read: off the home page, most ads first", () => {
    const ads = [ad({ link: "https://deals.com/a?utm_source=fb" }), ad({ link: "https://deals.com/a" }), ad({ link: "https://www.acme.com/" }), ad({ link: "https://acme.com/sale" })];
    assertEquals(landingsToRead(ads, "https://www.acme.com"), [{ url: "https://deals.com/a", ads: 2 }, { url: "https://acme.com/sale", ads: 1 }]);
});
const snap = (over) => ({
    at: "2026-11-12T10:00:00.000Z",
    listing: { rating: 4.6, reviews: 1000, category: "Flooring store", address: null },
    site: { title: "Acme", description: null, headline: "Fall Overstock Blowout!", offers: ["Save up to 75% off!"], phones: ["8555242312"], tools: [{ name: "Meta Pixel", group: "ads" }], formFields: 5 },
    pages: { total: 3, families: [], paths: ["/", "/about", "/service-areas/tulsa"] },
    ads: [ad({})],
    adFacts: { meta: 1, google: 0, googleMore: false, tracking: [], metaUrl: null, googleUrl: null, unread: [] },
    landings: [],
    jobs: { board: "greenhouse", total: 1, roles: [{ title: "Installer", location: "Phoenix, AZ", posted: null, url: null }] },
    ...over,
});
test("what changed between two checks", () => {
    const before = snap({});
    const after = snap({
        at: "2026-11-19T10:00:00.000Z",
        listing: { rating: 4.5, reviews: 1040, category: "Flooring store", address: null },
        site: { title: "Acme", description: null, headline: "Black Friday Flooring Deal!", offers: ["Save up to 78% off!", "Install by Thanksgiving or it's FREE!"], phones: ["8555242312", "8663038701"], tools: [{ name: "Meta Pixel", group: "ads" }, { name: "CallRail", group: "calls" }], formFields: 5 },
        pages: { total: 5, families: [], paths: ["/", "/about", "/service-areas/tulsa", "/service-areas/fresno", "/black-friday"] },
        ads: [ad({ key: "m:2", startedAt: "2026-11-15T00:00:00.000Z", days: 4, headline: "150 Homeowners in FRESNO" })],
        adFacts: { meta: 1, google: 0, googleMore: false, tracking: [], metaUrl: null, googleUrl: null, unread: [] },
        landings: [{ url: "https://deals.com/floor-new", host: "deals.com", ads: 1, own: false, read: true, title: null, headline: "First 150 Homeowners Only!", offers: [], phones: [], tools: [], formFields: 4 }],
        jobs: { board: "greenhouse", total: 2, roles: [{ title: "Installer", location: "Phoenix, AZ", posted: null, url: null }, { title: "Field Marketing Manager", location: "San Diego, CA", posted: "2026-11-14", url: null }] },
    });
    const changes = diffSnapshots(before, after);
    const kinds = changes.map((c) => c.kind);
    for (const k of ["ad_new", "ad_stopped", "headline", "offer_new", "offer_gone", "phone_new", "tool_new", "landing_new", "pages_new", "rating", "reviews", "job_new"])
        assert(kinds.includes(k), `missing ${k}`);
    assertEquals(changes.find((c) => c.kind === "ad_new")?.at, "2026-11-15T00:00:00.000Z");
    assertEquals(changes.find((c) => c.kind === "headline")?.after, "Black Friday Flooring Deal!");
    assert(changes.find((c) => c.kind === "ad_stopped")?.title.includes("98 days"));
    assertEquals(changes.find((c) => c.kind === "job_new")?.weight, 2);
    // The biggest news first.
    assertEquals(changes[0].weight, 3);
});
test("nothing changed is nothing to report", () => {
    assertEquals(diffSnapshots(snap({}), snap({ at: "2026-11-19T10:00:00.000Z" })), []);
});
test("an ad library that couldn't be read is never 'they stopped advertising'", () => {
    const unread = snap({ at: "2026-11-19T10:00:00.000Z", ads: [], adFacts: { meta: 0, google: 0, googleMore: false, tracking: [], metaUrl: null, googleUrl: null, unread: ["meta"] } });
    assertEquals(diffSnapshots(snap({}), unread).filter((c) => c.kind.startsWith("ad")), []);
    // The website not loading isn't news either.
    assertEquals(diffSnapshots(snap({}), snap({ at: "2026-11-19T10:00:00.000Z", site: null })), []);
});
test("an ad only disappears when the last check listed all of them", () => {
    const many = snap({ adFacts: { meta: 60, google: 0, googleMore: false, tracking: [], metaUrl: null, googleUrl: null, unread: [] } });
    const next = snap({ at: "2026-11-19T10:00:00.000Z", ads: [ad({ key: "m:9", startedAt: "2026-06-01T00:00:00.000Z" })], adFacts: { meta: 60, google: 0, googleMore: false, tracking: [], metaUrl: null, googleUrl: null, unread: [] } });
    // Not stopped (we only saw the top of 60), and not new either (it started before the last check).
    assertEquals(diffSnapshots(many, next).filter((c) => c.kind.startsWith("ad")), []);
});
test("started and stopped a whole channel", () => {
    const none = snap({ ads: [], adFacts: { meta: 0, google: 0, googleMore: false, tracking: [], metaUrl: null, googleUrl: null, unread: [] } });
    assertEquals(diffSnapshots(none, snap({ at: "2026-11-19T10:00:00.000Z" }))[0].kind, "ads_started");
    assertEquals(diffSnapshots(snap({}), { ...none, at: "2026-11-19T10:00:00.000Z" })[0].kind, "ads_paused");
});
test("a rebuilt website is one change", () => {
    const paths = (p) => Array.from({ length: 100 }, (_, i) => `/${p}/${i}`);
    const changes = diffSnapshots(snap({ pages: { total: 100, families: [], paths: paths("old") } }), snap({ at: "2026-11-19T10:00:00.000Z", pages: { total: 100, families: [], paths: paths("new") } }));
    assertEquals(changes.map((c) => c.kind), ["site_new"]);
});
test("sitemap pages by family", () => {
    const f = pageFacts(["https://a.com/", "https://a.com/about/", "https://a.com/service-areas/tulsa", "https://a.com/service-areas/fresno", "https://a.com/blog/x", "junk"]);
    assertEquals(f?.total, 5);
    assertEquals(f?.families[0], { family: "/service-areas", pages: 2 });
});
test("job boards: found in a page, read without anyone's name", () => {
    assertEquals(jobBoardIn(`<a href="http://www.acme.com/careers?gh_jid=5"></a><script src="https://boards.greenhouse.io/embed/job_board/js?for=expressflooring"></script>`), { ats: "greenhouse", slug: "expressflooring" });
    assertEquals(jobBoardIn(`<a href="https://jobs.lever.co/acme/123">`), { ats: "lever", slug: "acme" });
    assertEquals(careersLink(`<a href="/about">About</a><a href="/careers">Join us</a>`, "https://acme.com"), "https://acme.com/careers");
    const jobs = jobFacts({ ats: "greenhouse", slug: "x" }, { jobs: [{ title: "Field Brand Ambassador", location: { name: "Dallas, TX" }, first_published: "2026-10-07T12:00:00-04:00", absolute_url: "https://x/1", hiring_manager: "Someone" }] });
    assertEquals(jobs, { board: "greenhouse", total: 1, roles: [{ title: "Field Brand Ambassador", location: "Dallas, TX", posted: "2026-10-07", url: "https://x/1" }] });
    assertEquals(jobFacts({ ats: "greenhouse", slug: "x" }, { error: "not found" }), null);
});
test("history from before the company was added", () => {
    const h = historyFromCaptures([
        { month: "2026-04", link: "b", headline: "Save Big With Shop-at-Home Service", title: null, offers: ["Save up to 75% off!"] },
        { month: "2025-10", link: "a", headline: "LIMITED TIME OFFER", title: null, offers: ["Save up to 75% off!"] },
    ]);
    assertEquals(h.length, 1);
    assertEquals(h[0].at, "2026-04-01");
    assert(h[0].history);
    const certs = historyFromCerts([
        { name: "promos.acme.com", firstSeen: "2025-03-25" },
        { name: "www.acme.com", firstSeen: "2025-03-25" },
        { name: "vegas.acme.com", firstSeen: "2022-04-04" },
        { name: "other.com", firstSeen: "2026-01-01" },
    ], "acme.com", "2024-11-19T00:00:00.000Z");
    assertEquals(certs.map((c) => c.title), ["Put up a new site: promos.acme.com"]);
    assert(certs[0].why);
});
test("the timeline: newest day first, the same change once", () => {
    const c = { at: "2026-11-19T10:00:00.000Z", kind: "offer_new", title: "New offer on their website", detail: "78% off", weight: 3 };
    const t = timelineOf([{ changes: [c, { ...c, at: "2026-11-01", detail: "75% off" }] }, { changes: [c] }, { changes: "junk" }]);
    assertEquals(t.map((x) => x.detail), ["78% off", "75% off"]);
});
test("the company's own Google listing among the results", () => {
    const items = [
        { type: "maps_search", title: "Other Floors", place_id: "p1", url: "https://other.com", rating: { value: 4.9, votes_count: 20 } },
        { type: "maps_search", title: "Express Flooring", place_id: "p2", url: "https://www.expressflooring.com/", rating: { value: 4.6, votes_count: 3100 }, category: "Flooring store" },
    ];
    assertEquals(listingFrom(items, { placeId: null, host: "expressflooring.com", name: "x" })?.reviews, 3100);
    assertEquals(listingFrom(items, { placeId: null, host: null, name: "Nobody" }), null);
});
