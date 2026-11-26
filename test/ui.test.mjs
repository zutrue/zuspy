import { test } from "node:test";
import { deepStrictEqual as assertEquals, ok as assert } from "node:assert/strict";
import { imageInfo } from "../src/media.mjs";
import { logoLinks } from "../src/rules/site.mjs";
import { avatar, hueOf, initials } from "../src/report/ui.mjs";
import { anonymize, reportHtml } from "../src/report/render.mjs";

test("pictures: their real kind and size from their first bytes", () => {
  const png = new Uint8Array(24);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 180, 0, 0, 0, 120]);
  assertEquals(imageInfo(png), { type: "image/png", width: 180, height: 120 });
  // JPEG: a frame header after an APP0 block.
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, 0, 60, 0, 90, 3, 0, 0, 0]);
  assertEquals(imageInfo(jpg), { type: "image/jpeg", width: 90, height: 60 });
  // ICO with a 16px and a 48px image: its biggest.
  const ico = new Uint8Array(6 + 32);
  ico.set([0, 0, 1, 0, 2, 0]);
  ico[6] = 16;
  ico[22] = 48;
  assertEquals(imageInfo(ico), { type: "image/x-icon", width: 48, height: 48 });
  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 64, 0, 32, 0, 0, 0]);
  assertEquals(imageInfo(gif), { type: "image/gif", width: 64, height: 32 });
  // An SVG (it can carry scripts) and an HTML error page are not pictures.
  assertEquals(imageInfo(new TextEncoder().encode('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assertEquals(imageInfo(new TextEncoder().encode("<!doctype html><html><body>Not found</body></html>")), null);
});

test("logo links: app icons first, then the logo in the business markup, never an SVG", () => {
  const html = `<link rel="icon" href="/favicon.ico"><link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="icon" href="/logo.svg">
    <script type="application/ld+json">{"@type":"Plumber","logo":{"@type":"ImageObject","url":"https:\\/\\/cdn.x.com\\/logo.png"}}</script>`;
  assertEquals(logoLinks(html, "https://x.com/"), ["https://x.com/apple-touch-icon.png", "https://x.com/icon-192.png", "https://cdn.x.com/logo.png", "https://x.com/favicon.ico"]);
  assertEquals(logoLinks(`<link rel="icon" href="javascript:alert(1)">`, "https://x.com/"), []);
});

test("a business's picture: its logo, else its initials on its own colour; letters when names are hidden", () => {
  assertEquals(initials("Applewood Plumbing Heating & Electric"), "AP");
  assertEquals(initials("The A1 Garage Door Service LLC"), "AG");
  assertEquals(initials("Competitor B"), "B");
  assertEquals(initials("Another business 3"), "3");
  assert(Math.abs(hueOf("Competitor A") - hueOf("Competitor B")) > 30, "near names get far-apart colours");
  assert(avatar({ name: "A1", logo: "media/logo-c1.png" }, "sm").includes('src="media/logo-c1.png"'));
  assert(!avatar({ name: "A1", logo: "javascript:alert(1)" }, "sm").includes("javascript"));
  assert(!avatar({ name: "A1", rank: 2 }, "sm").includes('class="rk"'), "a rank badge only when asked for");
  assert(avatar({ name: "A1" }, "sm", { rank: 2 }).includes('class="rk"'));
});

test("anonymous: no logo or page picture survives", () => {
  const report = {
    zuspy: "t",
    input: { service: "plumber", location: "Denver, CO", business: null },
    created_at: "2026-11-26T00:00:00Z",
    ai: "t",
    meta_reader: "browser",
    cost: null,
    result: {
      summary: "s",
      themes: [],
      praise: [],
      ads: [],
      offers: [],
      readReviews: 0,
      lowReviews: 0,
      rivals: [{ id: "c1", name: "Applewood Plumbing", rank: 1, rating: 4.8, reviews: 100, website: "https://applewoodfixit.com/", logo: "media/logo-c1.jpg", photo: "media/photo-c1.jpg", adFacts: { meta: 1, google: 0, unread: [] } }],
      rivalAds: [
        { id: "c1-m1", rival: "c1", channel: "meta", kind: "image", advertiser: "Applewood Plumbing", headline: "h", body: "b", days: 3, versions: 1, image: null, video: null, sourceUrl: "https://www.facebook.com/ads/library/?id=1" },
        { id: "x-m1", rival: "x", channel: "meta", kind: "image", advertiser: "Bob the Plumber", avatar: "media/page-123.jpg", headline: "h", body: "b", days: 3, versions: 1, image: null, video: null, sourceUrl: null },
      ],
    },
  };
  report.result.summary = "Nobody at applewood called back, and Applewood shows up on time.";
  const html = reportHtml(anonymize(report));
  assert(!/applewood/i.test(html.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, "")), "a name typed in lowercase is hidden too");
  assert(html.includes("on time"), "an everyday phrase stays");
  assert(!html.includes("logo-c1"), "the competitor's logo");
  assert(!html.includes("page-123"), "another advertiser's page picture");
  assert(html.includes("photo-c1"), "the Maps photo stays, blurred by the page");
  assert(html.includes(".anon .comp .cover img{filter:blur"));
});
