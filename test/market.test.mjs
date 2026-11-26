import { test } from "node:test";
import { deepStrictEqual as assertEquals, ok as assert } from "node:assert/strict";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { matchTop, sameBusiness, searchPlace, topOfGoogle } from "../src/rules/google-top.mjs";
import { marketLines, scorecard, scorecardBlock, unknownsOf } from "../src/rules/scorecard.mjs";
import { changesBetween } from "../src/rules/changes.mjs";
import { settleSpyResult, spyPrompt } from "../src/rules/spy.mjs";
import { claudeArgs, claudeCliWrite, readAnswer, safeModel } from "../src/providers/claude-cli.mjs";

const rivals = [
  { id: "c1", name: "Precision Garage Door Service of Phoenix", placeId: "p1", rating: 4.9, reviews: 351, website: "https://precisiongarageaz.com/", rank: 1, lat: 33.4, lng: -112.0 },
  { id: "c2", name: "A1 Garage Door Service", placeId: "p2", rating: 4.8, reviews: 13484, website: "https://a1garage.com/", rank: 2, lat: 33.5, lng: -112.1 },
  { id: "c3", name: "Goody Garage Doors LLC", placeId: "p3", rating: 4.9, reviews: 6300, website: null, rank: 3, lat: 33.6, lng: -112.2 },
];

// The shape DataForSEO hands back for Google's Local Services Ads (trimmed from a real Phoenix answer, 2026-11-26).
const items = [
  {
    type: "local_services",
    title: "Sponsored Garage door repair | Phoenix",
    items: [
      { type: "local_services_element", title: "A1 Garage Door Service", description: "17+ years in business\nOpen 24 hours  ·  Serves Phoenix\n⁦24/7 emergency services  ·  Local business⁩", rating: { value: 4.8, votes_count: 13000 } },
      { type: "local_services_element", title: "Goody Garage Doors", description: "7+ years in business\nOpen now  ·  Serves Phoenix\nBeat or match price  ·  Free estimate", rating: { value: 4.9, votes_count: 6300 } },
      { type: "local_services_element", title: "I Love It Garage Doors", description: "1 year in business\nOpen now · Serves Phoenix\nFamily owned", rating: { value: 5, votes_count: 143 } },
      { type: "local_services_element", title: "Squeaks Services", description: "10+ years in business\n4.2 mi · 4620 E Colfax Ave\nDenver · On-time guarantee", rating: { value: 4.8, votes_count: 2000 } },
    ],
  },
  { type: "local_pack", title: "United Garage Door Repair" },
  { type: "paid", title: "Garage Door Repair Phoenix", domain: "example-doors.com", description: "Same day service. Call now." },
];

test("the top of Google: Local Services Ads with their badges, matched to the competitors by name", () => {
  const top = matchTop(topOfGoogle(items, "Denver"), rivals);
  assert(top.shown);
  assertEquals(top.businesses.map((b) => [b.position, b.name, b.rival, b.years]), [
    [1, "A1 Garage Door Service", "c2", 17],
    [2, "Goody Garage Doors", "c3", 7],
    [3, "I Love It Garage Doors", null, 1],
    [4, "Squeaks Services", null, 10],
  ]);
  assertEquals(top.businesses[0].badges, ["24/7 emergency services", "Local business"]);
  assertEquals(top.businesses[1].badges, ["Beat or match price", "Free estimate"]);
  assertEquals(top.businesses[3].badges, ["On-time guarantee"], "a distance, an address and a town aren't badges");
  assertEquals(top.paid, [{ title: "Garage Door Repair Phoenix", domain: "example-doors.com", text: "Same day service. Call now." }]);
  assertEquals(topOfGoogle([{ type: "organic" }]).shown, false);
  assert(sameBusiness("Goody Garage Doors", "Goody Garage Doors LLC"));
  assert(sameBusiness("A1 Garage Door Service", "A1 Garage Door Service of Phoenix"));
  assert(!sameBusiness("Garage Doors", "Goody Garage Doors"), "trade words in common aren't the same business");
  assert(!sameBusiness("Garage Door Repair", "Garage Door Repair Pros"), "a name of trade words only matches itself");
  assertEquals(searchPlace("Phoenix, AZ"), { location_name: "Phoenix,Arizona,United States" });
  assertEquals(searchPlace("Fort Collins, Colorado"), { location_name: "Fort Collins,Colorado,United States" });
  assertEquals(searchPlace("somewhere odd", rivals), { location_coordinate: "33.5000,-112.1000,20000" });
});

const sites = {
  c1: { read: true, stack: [{ name: "Meta Pixel", group: "ads", hidden: true }, { name: "CallRail", group: "calls", hidden: false }], booking: null, socials: [{ network: "facebook", url: "https://facebook.com/p" }], ai: { read: true, llms: false, blocked: ["ChatGPT search"], answersBlocked: true }, pages: { total: 34, towns: { count: 0, example: null }, blog: { posts: 13, fresh90: 6 } }, offers: ["Free estimates"], headline: "Same Day Repair", yearAgo: { month: "2025-11", headline: "Family owned since 1999", changed: true, offers: [] }, phoneNote: { google: "(602) 555-0199", site: "(602) 555-0101" } },
  c2: { read: true, stack: [{ name: "ServiceTitan", group: "booking", hidden: false }, { name: "LiveChat", group: "chat", hidden: true }], booking: "tool", socials: [], ai: { read: true, llms: true, blocked: [], answersBlocked: false }, pages: { total: 1627, towns: { count: 942, example: "/location/mesa-az" }, blog: { posts: 285, fresh90: 24 } }, offers: [], headline: "Fast, honest repair", yearAgo: null, phoneNote: null },
};
const facts = {
  c1: { meta: 0, google: 26, googleMore: false, unread: [], metaUrl: "https://www.facebook.com/ads/library/?q=p", googleUrl: "https://adstransparency.google.com/?domain=precisiongarageaz.com" },
  c2: { meta: 28, google: 40, googleMore: true, unread: [] },
  c3: { meta: 0, google: 0, googleMore: false, unread: ["meta"], metaUrl: "https://www.facebook.com/ads/library/?q=goody" },
};
const ads = [{ id: "c2-m1", rival: "c2", channel: "meta", days: 210 }, { id: "c1-g1", rival: "c1", channel: "google", days: 450 }];

test("the scorecard: on, off and unknown, decided by code", () => {
  const top = matchTop(topOfGoogle(items), rivals);
  const card = scorecard({ rivals, facts, ads, sites, top });
  const cell = (id, key) => card.rows.find((r) => r.id === id).cells[key];
  assertEquals(cell("c2", "meta"), { dots: 3, state: "on", text: "28 running · longest 210 days" });
  assertEquals(cell("c1", "meta"), { dots: 0, state: "off", text: "None now · pixel on site" });
  assertEquals(cell("c3", "meta").state, "unknown", "a library that couldn't be read is never 'none'");
  assertEquals(cell("c2", "lsa").text, "Paying · #1 of 4");
  assertEquals(cell("c1", "lsa").state, "off");
  assertEquals(cell("c2", "site").dots, 3);
  assertEquals(cell("c1", "ai"), { dots: 0, state: "off", text: "Blocks ChatGPT search" });
  assertEquals(cell("c3", "site"), { dots: 0, state: "unknown", text: "No website" });
  assertEquals(cell("c1", "followup").text, "call tracking");
  // Google showed no Local Services Ads: unknown for everyone, never "not in it".
  const none = scorecard({ rivals, facts, ads, sites, top: { shown: false, businesses: [] } });
  assert(none.rows.every((r) => r.cells.lsa.state === "unknown"));
  assertEquals(marketLines(card, rivals).slice(0, 3), ["1 of 2 checked run Facebook & Instagram ads", "2 of 3 run Google ads", "2 of 3 pay for Local Services Ads at the top of Google"]);
  const block = scorecardBlock({ rivals, card, sites, top });
  assert(block.includes("unknown (Couldn't read the library)"));
  assert(block.includes("inside Google Tag Manager only: Meta Pixel"));
  assert(block.includes("a year ago (2025-11) it led with"));
  assert(block.includes("I Love It Garage Doors (not in the Maps top)"));
});

test("what couldn't be seen, with a way to check each", () => {
  const list = unknownsOf({ input: { service: "garage door repair", location: "Phoenix, AZ" }, rivals, facts, sites, top: { shown: false, businesses: [], searches: 4 } });
  const what = list.map((u) => u.what);
  assert(what.includes("Goody Garage Doors LLC's Facebook & Instagram ads"));
  assert(what.includes("Local Services Ads"));
  assert(list.find((u) => u.what === "Local Services Ads").why.includes("our 4 searches"));
  assert(list.find((u) => u.what === "TikTok ads"));
});

test("since the last report: Maps moves, reviews, ads started and stopped, a new offer, a new tool, more town pages", () => {
  const prev = {
    created_at: "2026-11-18T12:00:00.000Z",
    result: {
      rivals: [
        { id: "c1", name: "A1 Garage Door Service", placeId: "p2", rank: 1, reviews: 13400, rating: 4.8, adFacts: { meta: 0, google: 30, unread: [] } },
        { id: "c2", name: "Old Rival Doors", placeId: "p9", rank: 2, reviews: 50, rating: 4.1, adFacts: { meta: 1, google: 0, unread: [] } },
      ],
      sites: { c1: { read: true, headline: "Fast, honest repair", offers: ["$400 OFF A NEW GARAGE DOOR!"], stack: [{ name: "ServiceTitan", group: "booking" }], pages: { towns: { count: 900 } }, ai: { read: true, answersBlocked: false } } },
      top: { shown: true, businesses: [] },
    },
  };
  const next = {
    created_at: "2026-11-26T12:00:00.000Z",
    result: {
      rivals: [rivals[0], { ...rivals[1], adFacts: { meta: 28, google: 40, unread: [] } }],
      rivalAds: [{ id: "c2-m1", rival: "c2", startedAt: "2026-11-20T00:00:00.000Z" }, { id: "c2-m2", rival: "c2", startedAt: "2026-10-01T00:00:00.000Z" }],
      sites: { c2: { read: true, headline: "Fast, honest repair", offers: ["Get $400 Off Garage Door Installation", "Free service call"], stack: [{ name: "ServiceTitan", group: "booking" }, { name: "CallRail", group: "calls" }], pages: { towns: { count: 942 } }, ai: { read: true, answersBlocked: false } } },
      top: { shown: true, businesses: [{ name: "A1 Garage Door Service", rival: "c2", position: 1 }] },
    },
  };
  const c = changesBetween(prev, next);
  const texts = c.items.map((i) => `${i.rival ?? "-"}: ${i.text}`);
  assertEquals(texts, [
    "c1: New in the Google Maps top 2, at #1",
    "c2: Moved from #1 to #2 on Google Maps",
    "c2: 84 new Google reviews (13,484 now)",
    "c2: Started Facebook & Instagram ads (28 running)",
    "c2: Google ads running: 30 → 40",
    "c2: 1 new ad started since Nov 18, 2026",
    "c2: Now in Google's Local Services Ads",
    "c2: New offer on its site: Free service call",
    "c2: Added CallRail to its site",
    "c2: Town pages: 900 → 942",
    "-: Old Rival Doors dropped out of the Google Maps top 2 (was #2)",
  ]);
  assertEquals(c.items.find((i) => i.kind === "new-ads").ad, "c2-m1");
  // One company's second Google listing is a new listing, not the first one moving.
  const two = changesBetween(
    { created_at: "2026-11-18T00:00:00Z", result: { rivals: [{ id: "c1", name: "A1 Garage Door Service", placeId: "pA", rank: 1, reviews: 13484, rating: 4.8 }] } },
    { created_at: "2026-11-26T00:00:00Z", result: { rivals: [{ id: "c1", name: "A1 Garage Door Service", placeId: "pA", rank: 1, reviews: 13484, rating: 4.8 }, { id: "c2", name: "A1 Garage Door Service", placeId: "pB", rank: 2, reviews: 3474, rating: 4.9 }] } },
  );
  assertEquals(two.items.map((i) => `${i.rival}: ${i.text}`), ["c2: New in the Google Maps top 2, at #2"]);
});

test("the 30-day plan: steps kept in week order, refs only to what exists, no budgets or ad results", () => {
  const reviews = [{ id: "c1-r1", rival: "c1", stars: 1, text: "They never showed up. Nobody called back either." }];
  const spied = { ads: [{ id: "c2-m1", rival: "c2", channel: "meta", days: 210 }], facts };
  const raw = {
    summary: "s",
    themes: [{ name: "No-shows", review_ids: ["c1-r1"], quotes: [{ id: "c1-r1", sentence: 0 }], angle: "a" }],
    ads: [{ headline: "On time, or it's free", primary_text: "We call ahead.", why: "w", needs: "" }],
    engines: [{ id: "c2", engine: "Facebook ads at scale and 942 town pages." }, { id: "c9", engine: "made up" }],
    plan: [
      { week: 2, step: "Build 5 town pages like A1's.", refs: ["c2", "nope"] },
      { week: 1, step: "Answer every call within an hour.", refs: ["c2-m1", "lsa"] },
      { week: 3, step: "Spend $50 a day on Facebook ads.", refs: [] },
      { week: 4, step: "Aim for a 3x ROAS on the first campaign.", refs: [] },
      { week: 9, step: "Post a review card in every truck.", refs: [] },
    ],
  };
  const res = settleSpyResult(raw, rivals, reviews, spied);
  assertEquals(res.plan, [
    { week: 1, step: "Answer every call within an hour.", refs: ["c2-m1", "lsa"] },
    { week: 2, step: "Build 5 town pages like A1's.", refs: ["c2"] },
    { week: 4, step: "Post a review card in every truck.", refs: [] },
  ]);
  assertEquals(res.rivals.find((r) => r.id === "c2").engine, "Facebook ads at scale and 942 town pages.");
  assert(!res.rivals.some((r) => r.engine === "made up"));
  // The brief carries the scorecard and asks for the plan.
  const prompt = spyPrompt({ service: "garage door repair", location: "Phoenix, AZ" }, rivals, reviews, {}, spied, "c1: ... MARKET: 1 of 3 run Facebook");
  assert(prompt.includes("HOW EACH ONE GETS CUSTOMERS"));
  assert(prompt.includes('"plan"') && prompt.includes('"engines"'));
});

test("Claude Code as the writer: its arguments, its answers read, a model name that can't be an option", () => {
  assertEquals(claudeArgs({ model: "sonnet", effort: "low" }), ["-p", "--output-format", "json", "--tools", "", "--no-session-persistence", "--strict-mcp-config", "--setting-sources", "project", "--model", "sonnet", "--effort", "low"]);
  assertEquals(safeModel("--dangerously-skip-permissions"), null);
  assertEquals(safeModel("claude-sonnet-5-5"), "claude-sonnet-5-5");
  assertEquals(readAnswer(JSON.stringify({ type: "result", is_error: false, result: '{"summary":"x"}', usage: { input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 7 }, modelUsage: { "claude-sonnet-5-5": {} } })), { ok: true, text: '{"summary":"x"}', model: "claude-sonnet-5-5", input: 15, output: 7 });
  const out = readAnswer(JSON.stringify({ type: "result", is_error: true, result: "Not logged in · Please run /login" }));
  assert(!out.ok && out.notLoggedIn);
  assert(readAnswer("", "error: unknown option '--effort'").unknownOption);
});

test("Claude Code as the writer: the brief goes in on stdin and every argument arrives whole (a .cmd on Windows)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "zuspy-fake-claude-"));
  const script = join(dir, "fake.mjs");
  // A stand-in for `claude`: answers with the arguments it got and the brief's length, as Claude Code's JSON would.
  writeFileSync(script, `let input = "";
process.stdin.on("data", (d) => (input += d)).on("end", () => {
  process.stdout.write(JSON.stringify({ type: "result", is_error: false, result: JSON.stringify({ args: process.argv.slice(2), chars: input.length, apiKey: process.env.ANTHROPIC_API_KEY ?? null }), usage: { input_tokens: 1, output_tokens: 1 }, modelUsage: { fake: {} } }));
});`);
  let bin;
  if (process.platform === "win32") {
    bin = join(dir, "claude.cmd");
    writeFileSync(bin, `@echo off\r\n"${process.execPath}" "${script}" %*\r\n`);
  } else {
    bin = join(dir, "claude");
    writeFileSync(bin, `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`);
    chmodSync(bin, 0o755);
  }
  const before = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "sk-should-not-pass";
  try {
    const res = await claudeCliWrite("x".repeat(50_000), { bin, model: "sonnet", effort: "low", timeoutMs: 30_000 });
    assert(res.ok, res.error);
    const got = JSON.parse(res.text);
    assertEquals(got.args, claudeArgs({ model: "sonnet", effort: "low" }));
    assertEquals(got.chars, 50_000);
    assertEquals(got.apiKey, null, "your plan is used, never an API key");
  } finally {
    if (before === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = before;
  }
});
