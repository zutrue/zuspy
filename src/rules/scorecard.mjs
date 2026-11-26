// How each competitor gets customers, channel by channel, decided by code from what was seen (no AI): Google Maps,
// Facebook and Instagram ads, Google ads, Local Services Ads, town pages and blog, follow-up tools, AI assistants and
// profiles. Each cell is "on" (seen doing it, 1-3 dots for how hard), "off" (checked and not seen) or "unknown"
// (couldn't check). The AI explains this card; it never overrides it. Also: what ZuSpy couldn't see, and how to check.
import { metaSearchUrl, searchName, townOf } from "./ads.mjs";
import { followUpOf, FOLLOW_UP_LABEL, SOCIAL_LABEL } from "./site.mjs";

export const CHANNELS = [
  ["maps", "Google Maps"],
  ["meta", "Facebook & Instagram ads"],
  ["google", "Google ads"],
  ["lsa", "Local Services Ads"],
  ["site", "Town pages & blog"],
  ["followup", "Follow-up tools"],
  ["ai", "AI assistants"],
  ["social", "Profiles linked"],
];

const num = (n) => Number(n).toLocaleString("en-US");
const cell = (dots, state, text) => ({ dots: Math.max(0, Math.min(3, dots)), state, text });
const unknown = (text) => cell(0, "unknown", text);
const has = (site, name) => !!site?.stack?.some((t) => t.name === name);
const list = (names, max = 3) => (names.length > max ? `${names.slice(0, max).join(", ")} +${names.length - max}` : names.join(", "));

/** Every competitor's row of cells. `sites` are the site checks, `top` the Local Services Ads search (matched). */
export function scorecard({ rivals, facts = {}, ads = [], sites = {}, top = null }) {
  const rows = rivals.map((r) => {
    const f = facts[r.id];
    const site = sites[r.id];
    const own = ads.filter((a) => a.rival === r.id);
    const longest = (channel) => Math.max(0, ...own.filter((a) => a.channel === channel).map((a) => a.days ?? 0));
    const cells = {};

    const reviews = r.reviews ?? 0;
    cells.maps = cell(reviews >= 1000 ? 3 : reviews >= 250 ? 2 : reviews >= 30 ? 1 : 0, "on", `#${r.rank}${r.rating != null ? ` · ${r.rating}★` : ""} · ${num(reviews)} reviews`);

    if (!f) cells.meta = unknown("Not checked");
    else if (f.unread?.includes("meta")) cells.meta = unknown("Couldn't read the library");
    else if (f.meta > 0) {
      const d = longest("meta");
      cells.meta = cell(f.meta >= 20 || d >= 180 ? 3 : f.meta >= 6 || d >= 60 ? 2 : 1, "on", `${num(f.meta)} running${d ? ` · longest ${num(d)} days` : ""}`);
    } else cells.meta = cell(0, "off", has(site, "Meta Pixel") ? "None now · pixel on site" : "None running");

    if (!f) cells.google = unknown("Not checked");
    else if (f.unread?.includes("google")) cells.google = unknown("Couldn't read the library");
    else if (f.google > 0) cells.google = cell(f.google >= 20 ? 3 : f.google >= 6 ? 2 : 1, "on", `${num(f.google)}${f.googleMore ? "+" : ""} running`);
    else cells.google = cell(0, "off", has(site, "Google Ads tag") ? "None found · ad tag on site" : "None found");

    if (!top?.shown) cells.lsa = unknown("Not shown this time");
    else {
      const b = top.businesses.find((x) => x.rival === r.id);
      cells.lsa = b ? cell(b.position <= 3 ? 3 : 2, "on", `Paying · #${b.position} of ${top.businesses.length}`) : cell(0, "off", "Not in it");
    }

    if (!site?.read) cells.site = unknown(r.website ? "Site didn't open" : "No website");
    else if (!site.pages) cells.site = unknown("No sitemap to read");
    else {
      const t = site.pages.towns.count;
      const fresh = site.pages.blog.fresh90;
      const dots = t >= 25 || fresh >= 10 ? 3 : t >= 5 || fresh >= 3 ? 2 : site.pages.total >= 15 ? 1 : 0;
      const parts = [t ? `${num(t)} town pages` : "no town pages", site.pages.blog.posts ? `${num(site.pages.blog.posts)} posts, ${num(fresh)} updated in 90 days` : "no blog"];
      cells.site = cell(dots, dots ? "on" : "off", parts.join(" · "));
    }

    const groups = followUpOf(site);
    if (!groups) cells.followup = unknown(r.website ? "Site didn't open" : "No website");
    else cells.followup = groups.length ? cell(groups.length, "on", groups.map((g) => FOLLOW_UP_LABEL[g]).join(", ")) : cell(0, "off", "None seen");

    if (!site?.read || !site.ai?.read) cells.ai = unknown(site?.read ? "robots.txt didn't open" : r.website ? "Site didn't open" : "No website");
    else if (site.ai.answersBlocked) cells.ai = cell(0, "off", `Blocks ${list(site.ai.blocked, 2)}`);
    else cells.ai = cell(site.ai.llms ? 2 : 1, "on", `${site.ai.blocked.length ? "Answers open, training blocked" : "Open to all"}${site.ai.llms ? " · has llms.txt" : ""}`);

    if (!site?.read) cells.social = unknown(r.website ? "Site didn't open" : "No website");
    else {
      const n = site.socials.length;
      cells.social = n ? cell(n >= 5 ? 3 : n >= 3 ? 2 : 1, "on", list(site.socials.map((s) => SOCIAL_LABEL[s.network] ?? s.network))) : cell(0, "off", "None linked");
    }
    return { id: r.id, cells };
  });
  return { channels: CHANNELS, rows };
}

/** One line per channel for the whole market: "3 of 5 run Facebook & Instagram ads". */
export function marketLines(card, rivals) {
  const n = rivals.length;
  const count = (key) => card.rows.filter((r) => r.cells[key].state === "on").length;
  const known = (key) => card.rows.filter((r) => r.cells[key].state !== "unknown").length;
  const out = [];
  const say = (key, what) => {
    if (!known(key)) return;
    out.push(`${count(key)} of ${known(key) === n ? n : `${known(key)} checked`} ${what}`);
  };
  say("meta", "run Facebook & Instagram ads");
  say("google", "run Google ads");
  say("lsa", "pay for Local Services Ads at the top of Google");
  say("site", "have town pages or a blog that's kept up");
  say("followup", "use follow-up tools (call tracking, texting, online booking, financing)");
  return out;
}

/** The card as the AI reads it, plus what each site showed (checked by code; the AI must not contradict it). */
export function scorecardBlock({ rivals, card, sites = {}, top = null }) {
  const label = Object.fromEntries(CHANNELS);
  const lines = rivals.map((r) => {
    const row = card.rows.find((x) => x.id === r.id);
    const cells = CHANNELS.map(([key]) => `${label[key]}: ${row.cells[key].state === "unknown" ? `unknown (${row.cells[key].text})` : row.cells[key].text}`).join("; ");
    const site = sites[r.id];
    const extra = [];
    if (site?.read) {
      if (site.headline) extra.push(`home page headline now: "${site.headline}"`);
      if (site.yearAgo) extra.push(site.yearAgo.changed ? `a year ago (${site.yearAgo.month}) it led with: "${site.yearAgo.headline}"` : `same headline a year ago (${site.yearAgo.month})`);
      if (site.yearAgo?.offers?.length) extra.push(`offers it ran a year ago and doesn't show now: ${site.yearAgo.offers.join(" | ")}`);
      if (site.offers.length) extra.push(`offers on its home page: ${site.offers.join(" | ")}`);
      const hidden = site.stack.filter((t) => t.hidden).map((t) => t.name);
      if (site.stack.length) extra.push(`tools on its site: ${site.stack.filter((t) => t.group !== "builder").map((t) => t.name).join(", ")}${hidden.length ? ` (inside Google Tag Manager only: ${hidden.join(", ")})` : ""}`);
      if (site.phoneNote) extra.push(`its site shows ${site.phoneNote.site}, Google shows ${site.phoneNote.google} (likely a tracking number)`);
      if (site.pages?.towns.example) extra.push(`town page example: ${site.pages.towns.example}`);
    }
    return `${r.id}: ${r.name}: ${cells}${extra.length ? `\n  ${extra.join("\n  ")}` : ""}`;
  });
  const lsa = top?.shown
    ? `\n\nLOCAL SERVICES ADS (Google's "Sponsored" Google-screened listings at the very top on a phone; paid per lead), in order:\n${top.businesses
        .map((b) => `  ${b.position}. ${b.name}${b.rival ? ` (= ${b.rival})` : " (not in the Maps top)"}: ${b.rating ?? "?"}★ from ${b.reviews != null ? num(b.reviews) : "?"} reviews${b.years ? `, ${b.years}+ years` : ""}${b.badges.length ? `; badges: ${b.badges.join(", ")}` : ""}`)
        .join("\n")}`
    : "\n\nLOCAL SERVICES ADS: Google didn't show any to our search this time (they rotate). Don't say who pays for them.";
  return `${lines.join("\n")}${lsa}\n\nMARKET: ${marketLines(card, rivals).join("; ")}.`;
}

/**
 * What ZuSpy couldn't see, why, and how to check it by hand. A competitor's channel marked unknown is never "they don't
 * do it": this list says so out loud.
 */
export function unknownsOf({ input, rivals, facts = {}, sites = {}, top = null }) {
  const out = [];
  const town = townOf(input.location);
  for (const r of rivals) {
    const f = facts[r.id];
    if (f?.sameAs) continue;
    if (f?.unread?.includes("meta")) out.push({ what: `${r.name}'s Facebook & Instagram ads`, why: "Meta's Ad Library didn't answer this time.", check: f.metaUrl ?? metaSearchUrl(searchName(r.name)) });
    if (f?.unread?.includes("google")) out.push({ what: `${r.name}'s Google ads`, why: "Google's Ads Transparency Center didn't answer this time.", check: f.googleUrl ?? null });
    if (r.website && !sites[r.id]?.read) out.push({ what: `${r.name}'s website`, why: "It didn't open for a reader (a bot check or a slow site), so its tools, pages and offers are unknown.", check: r.website });
  }
  if (!top?.shown)
    out.push({ what: "Local Services Ads", why: `Google rotates its "Sponsored" Google-screened listings and showed none to our ${top?.searches > 1 ? `${top.searches} searches` : "search"} this time.`, check: `https://www.google.com/search?q=${encodeURIComponent(`${input.service} near me`)}`, how: `Search "${input.service} near me" on your phone while in ${town}.` });
  out.push({ what: "Google search text ads", why: "They change by the minute and by who's searching; there's no public list of them by town.", check: `https://www.google.com/search?q=${encodeURIComponent(`${input.service} ${town}`)}`, how: `Search "${input.service} ${town}" on your phone; the Ads Transparency links above list each competitor's Google ads by website.` });
  const tiktok = rivals.filter((r) => sites[r.id]?.stack?.some((t) => t.name === "TikTok Pixel")).map((r) => r.name);
  out.push({ what: "TikTok ads", why: `TikTok has no public ad library for US advertisers.${tiktok.length ? ` The TikTok Pixel is on ${tiktok.join(", ")}'s site.` : ""}`, check: null });
  const nextdoor = rivals.filter((r) => sites[r.id]?.stack?.some((t) => t.name === "Nextdoor Pixel")).map((r) => r.name);
  out.push({ what: "Nextdoor ads", why: `Nextdoor has no public ad library.${nextdoor.length ? ` The Nextdoor Pixel is on ${nextdoor.join(", ")}'s site.` : ""}`, check: null });
  out.push({ what: "Followers and posts on their social profiles", why: "Not read; the profiles each site links to are listed above.", check: null });
  out.push({ what: "What they spend and what their ads bring in", why: "Nobody outside a company can see it. How long an ad has run is the best public sign that it pays.", check: null });
  out.push({ what: "Texts and emails to past customers", why: "They're sent from servers, out of sight. A texting or review tool on their site is the only sign.", check: null });
  return out;
}
