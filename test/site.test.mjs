import { test } from "node:test";
import { deepStrictEqual as assertEquals, ok as assert } from "node:assert/strict";
import {
  aiAccess,
  bookingButton,
  containerTools,
  followUpOf,
  gtmIds,
  phoneNote,
  robotsFacts,
  sameOffer,
  sitemapEntries,
  sitePages,
  siteSummary,
  socialsIn,
  stackOf,
  townShape,
  undouble,
  yearAgo,
} from "../src/rules/site.mjs";
import { diffSnapshots, offersIn } from "../src/rules/watch.mjs";

test("Tag Manager: container ids, and the pixels hidden inside a container's escaped code", () => {
  assertEquals(gtmIds(`<script src="https://www.googletagmanager.com/gtm.js?id=GTM-WKDTV3F"></script> GTM-WKDTV3F GTM-AB12CD GTM-ZZZZZZ`), ["GTM-WKDTV3F", "GTM-AB12CD"]);
  // How a container carries a pixel: inside an escaped string, slashes as \/ and tags as <.
  const js = `{"function":"__html","vtp_html":"\\u003Cscript\\u003E!function(f,b,e,v){}(window,document,'script','https:\\/\\/connect.facebook.net\\/en_US\\/fbevents.js');fbq('init','884676495678347');\\u003C\\/script\\u003E"},{"function":"__awct","vtp_conversionId":"10973989001"},{"function":"__baut"},"cdn.callrail.com","\\/wp-content\\/"`;
  const names = containerTools(js).map((t) => t.name);
  for (const n of ["Meta Pixel", "Google Ads tag", "Microsoft Ads tag", "CallRail"]) assert(names.includes(n), n);
  assert(!names.includes("WordPress"), "a site builder named in a container isn't the site's");
  const stack = stackOf([{ name: "Google Ads tag", group: "ads" }, { name: "ServiceTitan", group: "booking" }], [containerTools(js)]);
  assertEquals(stack.find((t) => t.name === "Google Ads tag").hidden, false);
  assertEquals(stack.find((t) => t.name === "Meta Pixel").hidden, true);
});

test("robots.txt: which AI assistants may read the site", () => {
  const r = robotsFacts(`User-agent: GPTBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /\n\nUser-agent: *\nDisallow: /wp-admin/\nSitemap: https://x.com/sitemap_index.xml`);
  assertEquals(r.bots.GPTBot, "blocked");
  assertEquals(r.bots.PerplexityBot, "blocked");
  assertEquals(r.bots.ClaudeBot, "unspecified");
  assertEquals(r.sitemaps, ["https://x.com/sitemap_index.xml"]);
  const a = aiAccess(r, "");
  assert(a.read && a.answersBlocked && !a.llms);
  assert(a.blocked.includes("Perplexity") && a.blocked.includes("OpenAI's training"));
  // A site shut to everyone shuts out every AI crawler it doesn't name.
  assertEquals(robotsFacts("User-agent: *\nDisallow: /").bots.ClaudeBot, "blocked");
  // An empty robots.txt (or none) lets everything read; one that couldn't be fetched is unknown.
  assert(!aiAccess(robotsFacts(""), null).answersBlocked);
  assertEquals(aiAccess(null, null).read, false);
});

test("sitemaps: an index and a list of pages with their last change", () => {
  assertEquals(sitemapEntries(`<sitemapindex><sitemap><loc>https://x.com/post-sitemap.xml</loc></sitemap><sitemap><loc><![CDATA[https://x.com/page-sitemap.xml]]></loc></sitemap></sitemapindex>`).children, ["https://x.com/post-sitemap.xml", "https://x.com/page-sitemap.xml"]);
  assertEquals(sitemapEntries(`<urlset><url><loc>https://x.com/a?x=1&amp;y=2</loc><lastmod>2026-11-01</lastmod></url><url><loc>https://x.com/b</loc></url></urlset>`).urls, [
    { loc: "https://x.com/a?x=1&y=2", lastmod: "2026-11-01" },
    { loc: "https://x.com/b", lastmod: null },
  ]);
});

test("town pages: shapes that are a service plus a place, never a guide or a news post", () => {
  const w = ["gara", "door", "repa"];
  assertEquals(townShape("garage-door-repair-mesa", w), "garage-door-repair-*");
  assertEquals(townShape("garage-door-repair-in-mesa-az", w), "garage-door-repair-in-*");
  assertEquals(townShape("mesa-garage-door-repair", w), "*-garage-door-repair");
  assertEquals(townShape("garage-door-repair-cost", w), null);
  assertEquals(townShape("garage-door-spring-repair", w), null);
  assertEquals(townShape("garage-door-safety", w), null, "every word of the service must be there");
  assertEquals(townShape("plumber-aurora", ["plum"]), "plumber-*");
});

test("pages: town pages by folder, state ending, a sitemap of their own and a shared shape; the blog and its fresh posts", () => {
  const now = Date.parse("2026-11-26T00:00:00Z");
  const e = (path, extra = {}) => ({ loc: `https://x.com${path}`, lastmod: null, ...extra });
  const entries = [
    e("/"),
    e("/about"),
    e("/areas-served/chandler"),
    e("/areas-served/gilbert"),
    e("/phoenix-az"),
    e("/acquisition-of-armstrong-garage-door-orlando-fl"),
    ...["mesa", "tempe", "peoria", "glendale", "surprise"].map((t) => e(`/garage-door-repair-${t}`)),
    e("/garage-door-repair-cost"),
    e("/cottonwood", { town: true }),
    e("/blog/new-springs", { lastmod: "2026-11-20" }),
    e("/blog/old-post", { lastmod: "2025-01-01" }),
    e("/why-doors-squeak", { post: true, lastmod: "2026-10-01T10:00:00+00:00" }),
    e("/media/logo.png"),
  ];
  const p = sitePages(entries, { service: "garage door repair", now });
  assertEquals(p.total, 16);
  assertEquals(p.towns.count, 9, "2 by folder, 1 by state, 5 by shape, 1 from a town sitemap; not the news post or the cost guide");
  assertEquals(p.blog, { posts: 3, fresh90: 2 });
  // Four pages of a shape are articles, not towns.
  assertEquals(sitePages(["a", "b", "c", "d"].map((t) => e(`/garage-door-repair-${t}ville`)), { service: "garage door repair", now }).towns.count, 0);
});

test("profiles, a booking button, and a phone number that differs from Google's", () => {
  const html = `<a href="https://www.facebook.com/A1GarageDoorService">fb</a><a href="https://www.facebook.com/sharer/sharer.php?u=x">share</a>
    <a href="https://www.instagram.com/a1garagedoorservice/">ig</a><a href='https://nextdoor.com/pages/a1-garage-door-service-tempe-az/'>nd</a>
    <a href="https://www.yelp.com/biz/a1-garage-door-service-phoenix">yelp</a><a class="btn" href="/book">Book Online Now</a>`;
  assertEquals(socialsIn(html).map((s) => s.network), ["facebook", "instagram", "nextdoor", "yelp"]);
  assertEquals(socialsIn(html)[0].url, "https://www.facebook.com/A1GarageDoorService");
  assertEquals(bookingButton(html), "Book Online Now");
  assertEquals(bookingButton(`<a href="/x">Read our booking policy and other long text about scheduling</a>`), null);
  assertEquals(phoneNote("+1 602-555-0199", ["6025550101"]), { google: "(602) 555-0199", site: "(602) 555-0101" });
  assertEquals(phoneNote("(602) 555-0101", ["6025550101"]), null);
  assertEquals(phoneNote(null, ["6025550101"]), null);
});

test("offers: the same offer in other words, and a customer's words aren't an offer", () => {
  assert(sameOffer("$400 OFF A NEW GARAGE DOOR!", "Get $400 Off Garage Door Installation"));
  assert(!sameOffer("$400 OFF A NEW GARAGE DOOR!", "$50 off any repair"));
  assert(sameOffer("Same Day Garage Door Repair", "Same-day garage door repair"));
  assert(!sameOffer("Same Day Garage Door Repair", "Free estimates on new doors"));
  assertEquals(offersIn(["Emailed this group and they sent out Cody the next day.", "Same Day Service", "I got free estimates from three companies."]), ["Same Day Service"]);
});

test("a year ago: the headline then, whether it changed, the offers that are gone", () => {
  const then = `<title>A1</title><h1>A1 From Day 1 – Call Your Local Garage Door Company</h1><p>$400 OFF A NEW GARAGE DOOR!</p><p>Free service call with any repair</p>`;
  const y = yearAgo(then, { headline: "Fast, Honest Repair", title: "A1", offers: ["Get $400 Off Garage Door Installation"] }, { month: "2025-11", link: "https://web.archive.org/web/20251120/https://a1garage.com/" });
  assertEquals(y.headline, "A1 From Day 1 – Call Your Local Garage Door Company");
  assert(y.changed);
  assertEquals(y.offers, ["Free service call with any repair"], "the $400 offer is still there, in other words");
  assertEquals(yearAgo(null, {}, null), null);
});

test("a site that didn't open is unknown in every part; follow-up tools grouped", () => {
  assertEquals(siteSummary({ url: "https://x.com/", html: null }), { read: false, url: "https://x.com/" });
  assertEquals(followUpOf({ read: false }), null);
  const s = siteSummary({ url: "https://x.com/", html: `<h1>Doors</h1><script src="https://cdn.callrail.com/x.js"></script><a href="/book">Schedule Service Today</a>`, robots: null, llms: null, entries: [], service: "garage door repair" });
  assert(s.read);
  assertEquals(followUpOf(s), ["calls", "booking"]);
  assertEquals(s.ai.read, false, "robots.txt not read: unknown");
  assertEquals(s.pages, null, "no sitemap entries: unknown");
});

test("a heading written twice (phone and desktop) is read once", () => {
  assertEquals(undouble("Repair Services for the Homeowner Repair Services for the Homeowner"), "Repair Services for the Homeowner");
  assertEquals(undouble("Fast fast repair repair"), "Fast fast repair repair");
  assertEquals(undouble(null), null);
});

test("watch: a pixel seen for the first time only because Tag Manager was read isn't a new tool", () => {
  const snap = (tools, tagManager) => ({ at: "2026-11-26T00:00:00Z", listing: null, site: { title: "t", headline: "h", offers: [], phones: [], tools, formFields: 0, ...(tagManager === undefined ? {} : { tagManager }) }, pages: null, ads: [], adFacts: null, landings: [], jobs: null });
  const before = snap([{ name: "Google Ads tag", group: "ads" }]);
  const after = snap([{ name: "Google Ads tag", group: "ads", hidden: false }, { name: "Meta Pixel", group: "ads", hidden: true }, { name: "CallRail", group: "calls", hidden: false }], true);
  const titles = diffSnapshots(before, after).map((c) => c.title);
  assert(titles.includes("Added CallRail to their website"));
  assert(!titles.includes("Added Meta Pixel to their website"));
  // Once both checks read Tag Manager, a pixel added inside it is news.
  const later = snap([...after.site.tools, { name: "TikTok Pixel", group: "ads", hidden: true }], true);
  assert(diffSnapshots(after, later).some((c) => c.title === "Added TikTok Pixel to their website"));
  // A container that couldn't be read this time doesn't make its pixels "removed".
  const unreadGtm = snap([{ name: "Google Ads tag", group: "ads", hidden: false }], false);
  assert(!diffSnapshots(after, unreadGtm).some((c) => c.title === "Removed Meta Pixel from their website"));
});
