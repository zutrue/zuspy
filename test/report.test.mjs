import { test } from "node:test";
import { deepStrictEqual as assertEquals, ok as assert } from "node:assert/strict";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { anonymize, nameAliases, onlyIf, reportHtml, reportMarkdown } from "../src/report/render.mjs";
import { safeUrl, scriptJson } from "../src/report/html-kit.mjs";

const EVIL = `<script>alert("x")</script><img src=x onerror=alert(1)>`;

function fixture() {
  const rivals = [
    { id: "c1", name: "Precision Garage Door Service of Phoenix", placeId: "p1", cid: null, rating: 4.9, reviews: 351, category: "Garage door supplier", website: "https://precisiongarageaz.com/", address: null, lat: null, lng: null, rank: 1 },
    { id: "c2", name: "A1 Garage Door Service", placeId: "p2", cid: null, rating: 4.8, reviews: 13484, category: null, website: "https://a1garage.com/", address: null, lat: null, lng: null, rank: 2 },
  ];
  const facts = { meta: 2, google: 1, googleMore: false, tracking: ["Meta Pixel"], metaUrl: "https://www.facebook.com/ads/library/?id=1", googleUrl: null, unread: [] };
  return {
    zuspy: "test",
    input: { service: "garage door repair", location: "Phoenix, AZ", business: "Delgado Doors", placeId: null },
    created_at: "2026-11-25T20:00:00.000Z",
    ai: "test",
    meta_reader: "browser",
    cost: { dataforseo_usd: 0.04, ai_tokens: { "claude-sonnet-5-5": { input: 30000, output: 4000 } }, ai_usd_at_list_price: 0.1, firecrawl_credits: 0, total_usd: 0.14 },
    result: {
      summary: `A1's prices run high and Precision's techs upsell. ${EVIL}`,
      theirAds: "A1 leads with tune-ups; call (602) 555-1234 or visit a1garage.com.",
      adMoves: [{ move: "Copy the longest-running layout", adId: "c2-m1" }],
      themes: [{ name: "Surprise prices", count: 3, rivals: ["c1", "c2"], quotes: [{ rival: "c2", rivalName: "A1 Garage Door Service", stars: 1, text: `The A1 Garage tech doubled the price. ${EVIL}` }], angle: "Price in writing first." }],
      praise: [{ name: "Friendly techs", count: 2 }],
      rivals: rivals.map((r) => ({ ...r, read: 10, low: 4, complaints: ["upselling"], praisedFor: ["fast"], promises: "Same day", adFacts: { ...facts }, adAngle: "Tune-up deals" })),
      ads: [{ theme: "Surprise prices", headline: "One price, in writing", primaryText: `No surprises. ${EVIL}`, why: "Answers the top complaint.", needs: "Only if you itemize." }],
      offers: [{ offer: "Free written quote", why: "Kills the fear", needs: "If it's really free" }],
      readReviews: 20,
      lowReviews: 8,
      rivalAds: [
        { id: "c2-m1", rival: "c2", channel: "meta", kind: "image", advertiser: "A1 Garage Door Service", headline: EVIL, body: "Book A1 today", cta: "Learn more", host: "a1garage.com", link: "https://a1garage.com/deal", image: "media/c2-m1.jpg", video: null, youtubeId: null, startedAt: "2026-01-01T00:00:00.000Z", days: 300, versions: 3, cards: 0, sourceUrl: "https://www.facebook.com/ads/library/?id=123" },
        { id: "c1-g1", rival: "c1", channel: "google", kind: "text", advertiser: "Precision Garage Door", headline: "Same-day repair", body: null, cta: null, host: "precisiongarageaz.com", image: "javascript:alert(1)", video: null, youtubeId: null, startedAt: null, days: 12, versions: 1, cards: 0, sourceUrl: "https://adstransparency.google.com/x" },
        { id: "x-m1", rival: "x", channel: "meta", kind: "video", advertiser: "Darcy's Garage Doors, LLC", headline: "Darcy's deal", body: "Call Darcy", cta: null, host: null, image: null, video: "media/x-m1.mp4", youtubeId: null, startedAt: null, days: 90, versions: 1, cards: 0, sourceUrl: "https://www.facebook.com/ads/library/?id=9" },
      ],
    },
  };
}

test("a name's first two words stand for it only when they're its own", () => {
  assert(!nameAliases("Same Day Water Heater Pros", { strict: true }).includes("Same Day"));
  assert(nameAliases("Professional Plumbers Denver").includes("Professional Plumbers"), "a competitor's short name is always hidden");
  assert(nameAliases("Benjamin Franklin Plumbing of Denver").includes("Benjamin Franklin"));
  assert(!nameAliases("Professional Plumbers Denver").includes("Professional"), "Google's badge 'Professional service' stays");
});

test("the page escapes everything that came from someone else's site, ad or review", () => {
  const html = reportHtml(fixture());
  assert(!html.includes("<script>alert"), "raw script from an ad or review");
  assert(!html.includes("<img src=x onerror"), "raw tag from an ad or review");
  assert(html.includes("&lt;script&gt;alert"));
  assert(!html.includes('src="javascript:'), "only https and the report's own files are used as sources");
  // The data block for the viewer can't close its own script tag.
  const data = html.match(/<script type="application\/json" id="ad-data">([\s\S]*?)<\/script>/)[1];
  assert(!data.includes("</script"));
  assertEquals(JSON.parse(data)["c2-m1"].headline, EVIL);
});

test("the page has every section, the honesty notes and the one-click version", () => {
  const html = reportHtml(fixture());
  for (const id of ['id="short"', 'id="ads"', 'id="rivals"', 'id="weak"', 'id="win"', 'id="offers"', 'id="how"', 'id="zuops"']) assert(html.includes(id), id);
  assert(html.includes("Only run it if</b> you itemize."));
  assert(html.includes("Only offer it if</b> it's really free") || html.includes("Only offer it if</b> it&#39;s really free"));
  assert(html.includes("zuops.com/features/competitor-spy"));
  assert(html.includes("300 days running"), "an ad running 60+ days is marked");
});

test("names: a business's full name, short forms and first word, never a trade word or a place", () => {
  assertEquals(nameAliases("A1 Garage Door Service"), ["A1 Garage Door Service", "A1 Garage", "A1"]);
  assertEquals(nameAliases("Arizona Garage Door & Repair"), ["Arizona Garage Door & Repair", "Arizona Garage"]);
  assert(nameAliases("Darcy's Garage Doors, LLC").includes("Darcy"));
  assert(!nameAliases("Garage Door Pros of Mesa").includes("Garage"));
});

test("anonymous: no business name, website, phone or link survives", () => {
  const r = anonymize(fixture());
  // The page's own icons are embedded as base64, which can spell anything.
  const text = (JSON.stringify(r) + reportHtml(r) + reportMarkdown(r)).replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "");
  for (const leak of ["Precision", "A1", "a1garage", "precisiongarageaz", "Darcy", "602", "Delgado", "facebook.com/ads/library/?id=123"]) assert(!text.includes(leak), leak);
  assert(text.includes("Competitor B"));
  assert(text.includes("Another business 1"));
  assert(reportHtml(r).includes('class="anon"'), "pictures are blurred");
});

test("only-if notes read once", () => {
  assertEquals(onlyIf("Only if you really call ahead"), "you really call ahead");
  assertEquals(onlyIf("Only when it rains"), "it rains");
  assertEquals(onlyIf("If you can"), "you can");
  assertEquals(onlyIf("You staff it"), "You staff it");
});

test("safe sources and data blocks", () => {
  assertEquals(safeUrl("media/c1-m1.jpg"), "media/c1-m1.jpg");
  assertEquals(safeUrl("checks/2026-11-25T20-00-00/media/c1-m1.jpg"), "checks/2026-11-25T20-00-00/media/c1-m1.jpg");
  assertEquals(safeUrl("../secret.txt"), null);
  assertEquals(safeUrl("javascript:alert(1)"), null);
  assertEquals(safeUrl("https://example.com/a.png"), "https://example.com/a.png");
  const s = scriptJson({ a: "</script><b>&" + String.fromCharCode(0x2028) });
  assert(!/[<>&]/.test(s));
  assertEquals(JSON.parse(s).a, "</script><b>&" + String.fromCharCode(0x2028));
});

test("keys: saved in a private file, an empty box keeps the saved value and '-' removes it", async () => {
  process.env.ZUSPY_HOME = mkdtempSync(join(tmpdir(), "zuspy-keys-"));
  const { writeKeys } = await import("../src/setup.mjs");
  const { keysFile, readKeysFile } = await import("../src/config.mjs");
  writeKeys({ DATAFORSEO_LOGIN: "me@x.com", DATAFORSEO_PASSWORD: "p@ss word#1", ZUSPY_AI: "claude-code" });
  writeKeys({ DATAFORSEO_LOGIN: "", DATAFORSEO_PASSWORD: "", ZUSPY_AI: "-", FIRECRAWL_API_KEY: "fc-123" });
  assertEquals(readKeysFile(), { DATAFORSEO_LOGIN: "me@x.com", DATAFORSEO_PASSWORD: "p@ss word#1", FIRECRAWL_API_KEY: "fc-123" });
  assert(readFileSync(keysFile(), "utf8").startsWith("# ZuSpy keys"));
  if (process.platform !== "win32") assertEquals(statSync(keysFile()).mode & 0o777, 0o600);
});

test("the AI is the one picked: a named service wins over other keys", async () => {
  const { aiConfig } = await import("../src/config.mjs");
  const keep = { ...process.env };
  try {
    for (const k of ["ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "ZURELAY_API_KEY", "ZUSPY_AI_BASE_URL", "ZUSPY_AI", "ZUSPY_MODEL"]) process.env[k] = "";
    assertEquals(aiConfig().engine, "claude-code");
    process.env.OPENROUTER_API_KEY = "or";
    process.env.ZURELAY_API_KEY = "zr";
    assertEquals(aiConfig("zurelay").baseURL, "https://api.zurelay.com/v1");
    assertEquals(aiConfig("openrouter").model, "anthropic/claude-sonnet-5.5");
    process.env.ANTHROPIC_API_KEY = "sk";
    assertEquals(aiConfig().engine, "anthropic");
    assertEquals(aiConfig().model, "claude-sonnet-5-5");
    assertEquals(aiConfig("claude-code").engine, "claude-code");
  } finally {
    process.env = keep;
  }
});
