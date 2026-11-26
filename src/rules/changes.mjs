// What changed in a market since the last report on it (same service, same town): who moved on Google Maps, who
// started or stopped advertising, new ads, new offers, headlines and tools on their sites, more town pages. Found by
// code from the two report.json files; a part either report couldn't read says nothing.
import { sameBusiness } from "./google-top.mjs";
import { sameOffer } from "./site.mjs";

const num = (n) => Number(n).toLocaleString("en-US");
const fold = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9$%]+/g, " ").trim();
const day = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** The same business in the earlier report: same Google place, else the same name. */
/**
 * The same listing in the other report: the same Google place, else the same name when either listing has no place id.
 * Two listings with different place ids are different listings, even of one company (A1 has three in Phoenix).
 */
function partner(r, list) {
  const byPlace = list.find((x) => (r.placeId && x.placeId === r.placeId) || (r.cid && x.cid === r.cid));
  if (byPlace) return byPlace;
  return list.find((x) => (!r.placeId || !x.placeId) && sameBusiness(x.name, r.name)) ?? null;
}

function adCount(label, before, after, out, rival) {
  if (before == null || after == null || before === after) return;
  if (before === 0) out.push({ rival, kind: "ads", text: `Started ${label} ads (${num(after)} running)` });
  else if (after === 0) out.push({ rival, kind: "ads", text: `Stopped all ${label} ads (had ${num(before)})` });
  else out.push({ rival, kind: "ads", text: `${label} ads running: ${num(before)} → ${num(after)}` });
}

/** prev, next: report.json objects. Returns { since, items: [{ rival (id in next) | null, kind, text, ad? }] }. */
export function changesBetween(prev, next) {
  if (!prev?.result || !next?.result) return null;
  const p = prev.result;
  const n = next.result;
  const since = prev.created_at;
  const items = [];
  const top = n.rivals.length;

  for (const r of n.rivals) {
    const was = partner(r, p.rivals);
    if (!was) {
      items.push({ rival: r.id, kind: "maps", text: `New in the Google Maps top ${top}, at #${r.rank}` });
      continue;
    }
    if (was.rank !== r.rank) items.push({ rival: r.id, kind: "maps", text: `Moved from #${was.rank} to #${r.rank} on Google Maps` });
    const more = (r.reviews ?? 0) - (was.reviews ?? 0);
    if (more > 0) items.push({ rival: r.id, kind: "reviews", text: `${num(more)} new Google ${more === 1 ? "review" : "reviews"} (${num(r.reviews)} now)` });
    if (r.rating != null && was.rating != null && Math.abs(r.rating - was.rating) >= 0.1) items.push({ rival: r.id, kind: "reviews", text: `Rating ${was.rating} → ${r.rating}` });

    // Ads: counts only when both reports read that library.
    const fb = (f, which) => (f && !f.sameAs && !f.unread?.includes(which) ? (which === "meta" ? f.meta : f.google) : null);
    adCount("Facebook & Instagram", fb(was.adFacts, "meta"), fb(r.adFacts, "meta"), items, r.id);
    adCount("Google", fb(was.adFacts, "google"), fb(r.adFacts, "google"), items, r.id);
    const fresh = (n.rivalAds ?? []).filter((a) => a.rival === r.id && a.startedAt && a.startedAt > since);
    if (fresh.length) items.push({ rival: r.id, kind: "new-ads", text: `${num(fresh.length)} new ${fresh.length === 1 ? "ad" : "ads"} started since ${day(since)}`, ad: fresh.sort((a, b) => (b.startedAt > a.startedAt ? 1 : -1))[0].id });

    // Local Services Ads: only when both searches showed them.
    if (p.top?.shown && n.top?.shown) {
      const inNow = n.top.businesses.some((b) => b.rival === r.id);
      const inThen = p.top.businesses.some((b) => b.rival === was.id);
      if (inNow && !inThen) items.push({ rival: r.id, kind: "lsa", text: "Now in Google's Local Services Ads" });
      if (!inNow && inThen) items.push({ rival: r.id, kind: "lsa", text: "No longer in Google's Local Services Ads" });
    }

    // Their site, when both reports read it.
    const a = p.sites?.[was.id];
    const b = n.sites?.[r.id];
    if (a?.read && b?.read) {
      const line = (s) => s.headline ?? s.title ?? "";
      if (line(a) && line(b) && fold(line(a)) !== fold(line(b))) items.push({ rival: r.id, kind: "site", text: `Changed its headline: "${line(a)}" → "${line(b)}"` });
      for (const o of b.offers.filter((x) => !a.offers.some((y) => sameOffer(y, x))).slice(0, 3)) items.push({ rival: r.id, kind: "offer", text: `New offer on its site: ${o}` });
      for (const o of a.offers.filter((x) => !b.offers.some((y) => sameOffer(y, x))).slice(0, 2)) items.push({ rival: r.id, kind: "offer", text: `Took this offer down: ${o}` });
      const tools = (s) => new Set(s.stack.filter((t) => t.group !== "builder" && t.group !== "analytics").map((t) => t.name));
      const ta = tools(a);
      const tb = tools(b);
      for (const t of tb) if (!ta.has(t)) items.push({ rival: r.id, kind: "tool", text: `Added ${t} to its site` });
      for (const t of ta) if (!tb.has(t)) items.push({ rival: r.id, kind: "tool", text: `Took ${t} off its site` });
      const ga = a.pages?.towns.count;
      const gb = b.pages?.towns.count;
      if (ga != null && gb != null && Math.abs(gb - ga) >= 5) items.push({ rival: r.id, kind: "pages", text: `Town pages: ${num(ga)} → ${num(gb)}` });
      if (a.ai?.read && b.ai?.read && a.ai.answersBlocked !== b.ai.answersBlocked) items.push({ rival: r.id, kind: "ai", text: b.ai.answersBlocked ? "Started blocking AI assistants from its site" : "Stopped blocking AI assistants from its site" });
    }
  }
  for (const was of p.rivals) {
    if (!partner(was, n.rivals)) items.push({ rival: null, kind: "maps", text: `${was.name} dropped out of the Google Maps top ${top} (was #${was.rank})` });
  }
  return { since, items };
}
