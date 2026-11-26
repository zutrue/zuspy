// `zuspy spy`: who you're up against on Google Maps, every ad they're running, what their customers complain about,
// and the ads and offers that win those customers.
//
//  1. Google Maps (live) for "<service> <town>": the first listings that aren't you are your competitors.
//  2. At once, per competitor: its ads on Facebook and Instagram (Meta's Ad Library) and Google (Ads Transparency
//     Center), its home page, its 30 lowest-rated and 10 most relevant Google reviews; plus one Ad Library search for
//     the service and town (others paying to reach the same customers).
//  3. The AI reads it all and writes the patterns, ads and offers. Code then checks its answer: counts come from the
//     review ids it lists, every quote is rebuilt from a real review sentence, and no ad names a competitor.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { aiConfig, dataForSeoAuth, reportsDir, VERSION, ZUOPS_URL } from "./config.mjs";
import { Meter } from "./meter.mjs";
import { Ai } from "./providers/ai.mjs";
import { DataForSeo } from "./providers/dataforseo.mjs";
import { metaReader } from "./providers/meta-library.mjs";
import { firstJson, pickRivals, settleSpyResult, spyInput, spyPrompt } from "./rules/spy.mjs";
import { spyOnAds } from "./spy-ads.mjs";
import { renderReport } from "./report/render.mjs";

export const MAX_RIVALS_LIMIT = 8;

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function newRunDir(service, location) {
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const base = join(reportsDir(), `${today}-${slug(`${service} ${location}`)}`);
  let dir = base;
  for (let n = 2; existsSync(dir); n++) dir = `${base}-${n}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

const writeJson = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

/**
 * opts: { service, location, business?, rivals?, reviews? (default true), ai? ("anthropic" | "openai" | "claude-code"), log }
 * Returns { dir, done, report? }.
 */
export async function spy(opts) {
  const log = opts.log ?? console.log;
  const parsed = spyInput({ service: opts.service, location: opts.location, business: opts.business });
  if ("error" in parsed) throw new Error(parsed.error);
  const input = parsed.input;
  const auth = dataForSeoAuth();
  if (!auth) throw new Error("ZuSpy needs a DataForSEO login for Google Maps, reviews and Google ads. Put DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in .env (see .env.example), then run `zuspy doctor`.");
  const cfg = aiConfig(opts.ai);
  if (cfg.engine !== "claude-code" && (!cfg.key || !cfg.model)) throw new Error(`The ${cfg.engine} AI isn't set up: its key or model is missing. Run \`zuspy doctor\`.`);
  const meter = new Meter();
  const dfs = new DataForSeo(auth, meter);
  const ai = cfg.engine === "claude-code" ? null : new Ai(cfg, meter);
  const started = Date.now();
  const deadline = started + 7 * 60_000;
  const max = Math.max(1, Math.min(MAX_RIVALS_LIMIT, Number(opts.rivals) || 5));

  log(`Finding who shows up first on Google Maps for "${input.service} ${input.location}" ...`);
  const items = await dfs.maps(`${input.service} ${input.location}`, 20);
  const rivals = pickRivals(items, { name: input.business, placeId: input.placeId }, max);
  if (!rivals.length) throw new Error("Google Maps showed no businesses for that search. Try the service in other words, or a bigger town nearby.");
  for (const r of rivals) log(`  #${r.rank} ${r.name} (${r.rating ?? "?"}★, ${r.reviews ?? "?"} reviews)${r.website ? ` ${r.website}` : ""}`);
  const dir = newRunDir(input.service, input.location);

  // Each rival's 30 worst reviews and 10 most relevant, read while the ads are pulled (they take a minute or two).
  const wantReviews = opts.reviews !== false;
  const tasks = wantReviews
    ? rivals.flatMap((r) =>
      r.placeId
        ? [
          { placeId: r.placeId, sort: "lowest_rating", depth: 30, lat: r.lat, lng: r.lng, tag: `${r.id}:low` },
          { placeId: r.placeId, sort: "relevant", depth: 10, lat: r.lat, lng: r.lng, tag: `${r.id}:top` },
        ]
        : []
    )
    : [];
  const owners = rivals.flatMap((r) => (wantReviews && r.placeId ? [r.id, r.id] : []));
  const ids = await dfs.postReviews(tasks).catch((e) => {
    log(`  (reviews not requested: ${String(e?.message ?? e).slice(0, 160)})`);
    return [];
  });

  const reader = metaReader();
  log(`Pulling their ads: Facebook & Instagram through ${reader.detail}; Google through DataForSEO ...`);
  const spied = await spyOnAds({ dfs, ai, dir, meter, deadline, service: input.service, location: input.location, log }, rivals);

  let reviews = [];
  if (ids.some(Boolean)) {
    log("Reading their customers' Google reviews ...");
    const states = await dfs.waitForReviews(ids, Math.min(deadline, Date.now() + 4 * 60_000), 6_000);
    const seen = new Set();
    const counter = {};
    states.forEach((s, k) => {
      const rival = owners[k];
      for (const rv of s?.reviews ?? []) {
        const key = `${rival}:${rv.text.slice(0, 80)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        counter[rival] = (counter[rival] ?? 0) + 1;
        reviews.push({ id: `${rival}-r${counter[rival]}`, rival, stars: rv.stars, text: rv.text.slice(0, 600) });
      }
    });
    log(`  ${reviews.length} reviews read (${reviews.filter((r) => r.stars <= 3).length} of them 3★ or lower)`);
  }
  // A report stands on their ads or their reviews; with neither there is nothing to show.
  if (reviews.length < 3 && !spied.ads.length) throw new Error("No ads were found and Google didn't hand over enough of their reviews in time. Try again in a few minutes.");
  if (reviews.length < 3) reviews = [];

  const state = {
    zuspy: VERSION,
    input,
    started_at: new Date(started).toISOString(),
    rivals,
    reviews,
    spied: { ads: spied.ads, facts: spied.facts, sites: spied.sites },
    meta_reader: reader.how,
    ai: cfg.engine === "claude-code" ? "Claude Code" : ai.label,
  };
  writeJson(join(dir, "state.json"), state);
  const prompt = spyPrompt(input, rivals, reviews, spied.sites, spied);

  if (cfg.engine === "claude-code") {
    writeFileSync(join(dir, "prompt.md"), claudeCodePrompt(dir, prompt, spied.ads));
    writeJson(join(dir, "cost.json"), meter.toJSON());
    log("");
    log(`Collected: ${rivals.length} competitors, ${spied.ads.length} ads, ${reviews.length} reviews. Data cost: ${meter.line()}.`);
    log(`No AI key is set, so Claude Code writes the analysis:`);
    log(`  1. Read ${join(dir, "prompt.md")}`);
    log(`  2. Write the JSON it asks for to ${join(dir, "analysis.json")}`);
    log(`  3. Run: zuspy finish "${dir}"`);
    return { dir, done: false };
  }

  log(`Finding the patterns and writing your ads (${ai.label}) ...`);
  let result = null;
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    const { text, cutOff } = await ai.ask(prompt, { maxTokens: 16_000 });
    result = settleSpyResult(firstJson(text), rivals, reviews, spied);
    if (!result) log(cutOff ? "  (the answer ran out of room; asking again)" : "  (the answer couldn't be read; asking again)");
  }
  if (!result) throw new Error("The AI's answer couldn't be turned into a report twice in a row. The data is saved; run `zuspy finish` on the folder with your own analysis.json, or try again.");
  return { dir, done: true, report: saveReport(dir, state, result, meter.toJSON(), log) };
}

/** The claude-code engine's second half: analysis.json (written by Claude Code) -> the report. */
export function finish(dir, log = console.log) {
  const state = JSON.parse(readFileSync(join(dir, "state.json"), "utf8"));
  const file = join(dir, "analysis.json");
  if (!existsSync(file)) throw new Error(`No analysis.json in ${dir}. Write it from prompt.md first.`);
  const raw = firstJson(readFileSync(file, "utf8"));
  if (!raw) throw new Error("analysis.json isn't a JSON object.");
  // Words Claude Code copied off Google's search-ad pictures.
  const byId = new Map(state.spied.ads.map((a) => [a.id, a]));
  for (const w of Array.isArray(raw.google_ad_words) ? raw.google_ad_words : []) {
    const ad = byId.get(String(w?.id));
    if (!ad || ad.channel !== "google") continue;
    const line = (v, max) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) || null : null);
    ad.headline = line(w?.headline, 160) ?? ad.headline;
    ad.body = line(w?.text, 500) ?? ad.body;
  }
  const result = settleSpyResult(raw, state.rivals, state.reviews, state.spied);
  if (!result) throw new Error("analysis.json has no themes, ads or competitor ads ZuSpy could use. Check it follows the shape in prompt.md.");
  // What the checks kept, so whoever wrote analysis.json knows what didn't make it and why.
  const n = (v) => (Array.isArray(v) ? v.length : 0);
  // [written, kept, the most a report keeps, what, why one is dropped]
  const kept = [
    [n(raw.themes), result.themes.length, 6, "themes", "a theme needs real review ids from the brief"],
    [n(raw.ads), result.ads.length, 8, "ads", "an ad that names a competitor, or has no headline or text, is dropped"],
    [n(raw.offers), result.offers.length, 6, "offers", "an offer that names a competitor is dropped"],
    [n(raw.ad_moves), result.adMoves?.length ?? 0, 3, "moves", "a move with a dollar amount or ad results is dropped"],
  ];
  const quotes = result.themes.reduce((s, t) => s + t.quotes.length, 0);
  log(`Checked: kept ${kept.map(([had, got, , what]) => `${got} of ${had} ${what}`).join(", ")}, and ${quotes} quotes rebuilt from real review sentences.`);
  for (const [had, got, most, what, why] of kept) if (got < Math.min(had, most)) log(`  ${Math.min(had, most) - got} ${what} dropped: ${why}.`);
  const cost = existsSync(join(dir, "cost.json")) ? JSON.parse(readFileSync(join(dir, "cost.json"), "utf8")) : null;
  return saveReport(dir, state, result, cost, log);
}

function saveReport(dir, state, result, cost, log) {
  const report = {
    zuspy: VERSION,
    input: state.input,
    created_at: new Date().toISOString(),
    ai: state.ai,
    meta_reader: state.meta_reader,
    cost,
    result,
  };
  writeJson(join(dir, "report.json"), report);
  renderReport(dir, report);
  log("");
  log(`Done. ${result.rivals.length} competitors, ${result.rivalAds?.length ?? 0} ads, ${result.readReviews} reviews read.`);
  if (cost) log(`Cost: ${typeof cost.total_usd === "number" ? `about $${cost.total_usd.toFixed(2)}` : ""} (${costLine(cost)}).`);
  log(`Report: ${join(dir, "report.html")}`);
  log("");
  log(`Made with ZuSpy. Rather not manage API keys? Competitor Spy is built into Zuops: one click, and it keeps watching them: ${ZUOPS_URL}`);
  return report;
}

export function costLine(cost) {
  const parts = [`DataForSEO $${Number(cost.dataforseo_usd ?? 0).toFixed(3)}`];
  if (cost.ai_tokens && Object.keys(cost.ai_tokens).length) parts.push(cost.ai_usd_at_list_price == null ? "AI: see your provider" : `AI $${Number(cost.ai_usd_at_list_price).toFixed(3)} at Anthropic list price`);
  if (cost.firecrawl_credits) parts.push(`${cost.firecrawl_credits} Firecrawl credits`);
  return parts.join(", ");
}

/** The prompt Claude Code answers when there's no AI key: the same prompt as the API's, plus where to write. */
function claudeCodePrompt(dir, prompt, ads) {
  // The longest-running of each competitor's Google picture ads, at most 12: enough to know what they say.
  const perRival = new Map();
  const unread = ads
    .filter((a) => a.channel === "google" && a.kind !== "video" && a.image && !/^https?:/.test(a.image) && !a.headline && !a.body)
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0))
    .filter((a) => {
      const n = perRival.get(a.rival) ?? 0;
      perRival.set(a.rival, n + 1);
      return n < 3;
    })
    .slice(0, 12);
  const pictures = unread.length
    ? `
Optional, but it makes the report better: Google shows its search and picture ads as images, so their words aren't in
the brief. Open these pictures (each competitor's longest-running ones) and copy the words printed on each, exactly as
written, into "google_ad_words". Skip any you can't read, any error page, and Google's layout sheets ("Collapsed ad on
mobile ... Expanded ad").
${unread.map((a) => `- ${a.id}: ${join(dir, a.image)}`).join("\n")}
`
    : "";
  return `# ZuSpy analysis task

You are writing the analysis part of a ZuSpy competitor report. Use only what is below; don't search the web.
Write ONE JSON object (no markdown fences, nothing else) to:

    ${join(dir, "analysis.json")}

Then run: zuspy finish "${dir}"
${pictures}
The JSON is the shape asked for at the end of the brief${unread.length ? `, plus:\n "google_ad_words": [{"id": "c1-g2", "headline": "...", "text": "..."}]` : ""}.
ZuSpy checks it with code before it becomes the report: theme counts come from the review ids you list (only real ids
count), quotes are rebuilt from the review sentence you point at, and ads or offers naming a competitor are dropped.
A review may be listed under more than one theme when it complains about both. Reviews and ad text were cut to a few
hundred characters, so pick quote sentences that are complete. "google_ad_words" is copied as printed, names and all;
the no-names rule is only for the ads and offers you write. An "ad_moves" line with a dollar amount or ad results
(ROAS, CTR) is dropped, so describe the move without them. "zuspy finish" prints what its checks kept and dropped.

---

${prompt}
`;
}
