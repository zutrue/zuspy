// The spy report as a page (report.html, one file that opens in any browser) and as Markdown (report.md, for pasting
// into a doc or handing to an AI). Both come from report.json; `zuspy rebuild` draws them again.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { adTotals, MARKET, searchName } from "../rules/spy.mjs";
import { ctaBlock, esc, footer, heading, iconUrl, logoDataUrl, plural, safeUrl, scriptJson, STYLES, TOC_SCRIPT, topbar } from "./html-kit.mjs";
import { ZUOPS_URL } from "../config.mjs";
import { CHANNELS } from "../rules/scorecard.mjs";
import { SOCIAL_LABEL } from "../rules/site.mjs";
import { changesSection, nextSteps, planSection, scorecardSection, SECTION_STYLES, sitesSection, topBlock, unknownsSection } from "./sections.mjs";
import { avatar, hueOf, ICON, initials, platformMark, UI_STYLES } from "./ui.mjs";

const LONG_DAYS = 60;
const CHANNEL = { meta: "Facebook & Instagram", google: "Google" };
const KIND = { video: "Video", image: "Image", carousel: "Carousel", text: "Search ad" };
const kindOf = (a) => (a.channel === "google" && a.kind === "text" ? "text" : a.kind === "carousel" ? "image" : a.kind);

/** "Only if you really call ahead" -> "you really call ahead": the label already says "Only run it if". */
export const onlyIf = (s) => String(s ?? "").replace(/^\s*only\s+(if|when)\s+/i, "").replace(/^\s*if\s+/i, "");

const stars = (n) => (n == null ? "" : `<span class="stars" aria-label="${esc(n)} stars">${"★".repeat(Math.round(n))}${"☆".repeat(5 - Math.round(n))}</span>`);
const monthYear = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "");
const num = (n) => Number(n).toLocaleString("en-US");

const GENERIC = new Set(
  "a an and the of at by in on for to all best local pro pros family quality affordable american national united premier elite top first 24 hour hours same day next fast quick speedy rapid express right away reliable honest trusted professional professionals licensed certified insured master superior quality expert experts water heater heaters sewer drain drains emergency garage garages door doors gate gates repair repairs service services company co llc inc corp group roof roofs roofing plumbing plumber plumbers hvac heating cooling air ac med medical spa spas wellness aesthetics dental dentist electric electrical pest control lawn landscaping cleaning carpet pool pools solar home homes house painting window windows auto towing moving movers"
    .split(" "),
);
const PLACES = new Set(
  "alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada ohio oklahoma oregon pennsylvania tennessee texas utah vermont virginia washington wisconsin wyoming new north south east west san santa los las saint st fort mount lake"
    .split(" "),
);

// Everyday words a business name may start with: as a name they're hidden only when written with their capital.
const ORDINARY = new Set(
  "time precision mighty golden brothers speed apex summit pioneer eagle liberty patriot titan legacy ace star sun sunrise sunset sunshine blue green red black white silver gold diamond crystal royal king queen prince knight hero champion victory first second third one two three city metro valley mountain river ocean coastal desert canyon mesa ridge peak pine oak cedar maple willow rock stone iron steel copper every true pure clear bright fresh clean modern classic old big little great good right left central western eastern northern southern tipping happy smart total complete advanced precise perfect absolute"
    .split(" "),
);

/**
 * The ways a report's text may name a business: its full name, its name without a "| keywords" tail, its first two
 * words, and its first word when that word is its own ("A1", "Precision", "Darcy"), never a trade word or a place.
 */
export function nameAliases(name, { strict = false } = {}) {
  const base = searchName(String(name ?? ""));
  const words = base.split(/\s+/).filter(Boolean);
  const out = new Set([String(name ?? "").trim(), base]);
  // Its first two words. For a business that only shows in its own card (strict), not when both are words anyone may
  // write: "Same Day" Water Heater Pros mustn't swap out a "Same Day" offer.
  const two = words.slice(0, 2).map((w) => w.replace(/[,.]$/, ""));
  if (words.length >= 3 && (!strict || two.some((w) => !GENERIC.has(w.toLowerCase().replace(/[’']s$/, ""))))) out.add(two.join(" "));
  const first = (words[0] ?? "").replace(/[’']s$/i, "").replace(/[^A-Za-z0-9&]/g, "");
  if (first && words.length > 1 && !GENERIC.has(first.toLowerCase()) && !PLACES.has(first.toLowerCase()) && (first.length >= 3 || /\d/.test(first))) out.add(first);
  return [...out].filter((a) => a.length >= 2);
}

/**
 * The report with every business name swapped for "Competitor A", "Competitor B" ..., links taken out and pictures
 * blurred: for sharing a report (or a screenshot of one) without naming anyone.
 */
export function anonymize(report) {
  const r = structuredClone(report);
  const res = r.result;
  const names = new Map();
  res.rivals.forEach((rv, i) => names.set(rv.id, `Competitor ${String.fromCharCode(65 + i)}`));
  const swaps = [];
  for (const rv of res.rivals) for (const n of nameAliases(rv.name)) swaps.push([n, names.get(rv.id)]);
  const market = new Map();
  for (const a of res.rivalAds ?? []) {
    if (a.rival === MARKET && a.advertiser && !market.has(a.advertiser)) market.set(a.advertiser, `Another business ${market.size + 1}`);
  }
  for (const b of res.top?.businesses ?? []) {
    if (!b.rival && !market.has(b.name)) market.set(b.name, `Another business ${market.size + 1}`);
  }
  for (const [n, to] of market) for (const alias of nameAliases(n, { strict: true })) swaps.push([alias, to]);
  if (r.input.business) for (const alias of nameAliases(r.input.business)) swaps.push([alias, "your business"]);
  swaps.sort((a, b) => b[0].length - a[0].length);
  const patterns = swaps.map(([from, to]) => {
    const body = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    // A longer name in any case. One word in any case too ("anyone at applewood"), unless it's an everyday word
    // ("Time", "Precision"): then only with its capital, so "on time" stays "on time".
    const anyCase = /\s/.test(from) || !ORDINARY.has(from.toLowerCase());
    return [new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, anyCase ? "gi" : "g"), to];
  });
  const clean = (s) => {
    if (typeof s !== "string") return s;
    let out = s;
    for (const [re, to] of patterns) out = out.replace(re, to);
    return out.replace(/\b[a-z0-9-]+\.(com|net|org|co|us|biz|info|io)\b/gi, "their-site.com").replace(/\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g, "(555) 010-0000");
  };
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return clean(v);
  };
  r.result = walk(res);
  for (const rv of r.result.rivals) {
    rv.name = names.get(rv.id);
    rv.website = null;
    rv.address = null;
    // A logo names them as surely as their name: a letter instead. Their Maps photo stays, blurred like their ads.
    rv.logo = null;
    if (rv.adFacts) rv.adFacts = { ...rv.adFacts, metaUrl: null, googleUrl: null };
  }
  for (const a of r.result.rivalAds ?? []) {
    if (a.rival !== MARKET) a.advertiser = names.get(a.rival) ?? a.advertiser;
    a.sourceUrl = null;
    a.avatar = null;
    a.host = a.host ? "their-site.com" : null;
    a.link = null;
    a.youtubeId = null;
  }
  for (const t of r.result.themes) for (const q of t.quotes) q.rivalName = names.get(q.rival) ?? q.rivalName;
  for (const b of r.result.top?.businesses ?? []) b.name = b.rival ? names.get(b.rival) ?? b.name : market.get(res.top.businesses.find((x) => x.position === b.position)?.name) ?? b.name;
  for (const s of Object.values(r.result.sites ?? {})) {
    s.url = null;
    s.gtm = [];
    s.phones = [];
    if (s.yearAgo) s.yearAgo.link = null;
    // Which networks they're on stays; the links (their handles) go.
    s.socials = (s.socials ?? []).map((x) => ({ network: x.network, url: null }));
  }
  if (r.result.changes) r.result.changes.folder = null;
  if (r.input.business) r.input.business = "your business";
  // Which service ran the AI is the reader's own business: the model is enough.
  if (typeof r.ai === "string") r.ai = r.ai.replace(/\s*\(.*\)\s*$/, "");
  r.anonymous = true;
  return r;
}

const daysBadge = (d) =>
  d == null ? "" : `<span class="badge${d >= LONG_DAYS ? " proven" : ""}">${d >= LONG_DAYS ? `${num(d)} days running` : d >= 1 ? `${num(d)} ${d === 1 ? "day" : "days"}` : "New today"}</span>`;

const whoOf = (a, byId) => (a.rival === MARKET ? a.advertiser : byId.get(a.rival)?.name ?? a.advertiser);
/** The picture an ad's card shows for whoever runs it: the competitor's logo, or another advertiser's page picture. */
const faceOf = (a, byId) => (a.rival === MARKET ? { name: a.advertiser, logo: a.avatar } : byId.get(a.rival) ?? { name: a.advertiser });
/** The words the search box looks through. */
const searchText = (a, who) => [who, a.headline, a.body, a.cta, a.host].filter(Boolean).join(" ").replace(/\s+/g, " ").toLowerCase().slice(0, 800);

/** One ad as a card: who runs it and where, the picture (or its words), how long it has run, its words and button. */
export function adCard(a, rivalsById, n) {
  const img = safeUrl(a.image);
  const video = safeUrl(a.video);
  const who = whoOf(a, rivalsById);
  // Google shows a search ad as a picture of the ad: shown whole, top first, on white.
  const shot = a.channel === "google" && a.kind !== "video";
  const isVideo = !!(video || a.youtubeId || a.kind === "video");
  let media = "";
  if (img) media = `<img loading="lazy" src="${esc(img)}" alt="">`;
  else if (video) media = `<video preload="metadata" muted playsinline src="${esc(video)}#t=0.5"></video>`;
  const badges = `<div class="badges">${daysBadge(a.days)}${a.versions > 1 ? `<span class="badge">${num(a.versions)} versions</span>` : ""}</div>`;
  const mediaBox = media
    ? `<div class="media${shot ? " shot" : ""}">${media}${badges}${isVideo ? `<span class="badge play">${ICON.play}Video</span>` : ""}</div>`
    : `<div class="media words">${badges}<div class="hl">${esc(a.headline ?? "")}</div><div class="tx">${esc(a.body ?? "")}</div></div>`;
  // A Meta headline is often just the page's name: shown once.
  const headline = a.headline && a.headline.trim().toLowerCase() !== String(who).trim().toLowerCase() ? a.headline : null;
  const words = media ? `${headline ? `<div class="hl">${esc(headline)}</div>` : ""}${a.body ? `<div class="tx">${esc(a.body)}</div>` : ""}` : "";
  const start = a.startedAt ? Date.parse(a.startedAt) || 0 : 0;
  return `<article class="ad" tabindex="0" data-id="${esc(a.id)}" data-rival="${esc(a.rival)}" data-channel="${esc(a.channel)}" data-kind="${esc(kindOf(a))}" data-days="${esc(a.days ?? -1)}" data-start="${start}" data-versions="${esc(a.versions ?? 1)}" data-n="${n}" data-q="${esc(searchText(a, who))}">
  <div class="ad-h">${avatar(faceOf(a, rivalsById), "sm")}<div class="ad-who"><span class="n" title="${esc(who)}">${esc(who)}</span><span class="s">${platformMark(a.channel)}${esc(a.channel === "meta" ? "Facebook" : "Google")}${a.startedAt ? ` · since ${esc(monthYear(a.startedAt))}` : ""}</span></div></div>
  ${mediaBox}
  <div class="body">
    ${words}
    <div class="foot">${a.cta ? `<span class="cta-chip">${esc(a.cta)}</span>` : `<span>${esc(KIND[a.kind] ?? a.kind)}${a.cards ? ` · ${num(a.cards)} cards` : ""}</span>`}${a.host ? `<span class="host">${esc(a.host)}</span>` : ""}</div>
  </div>
</article>`;
}

/** One competitor as a card: its Google Maps cover photo and logo, where it advertises, what it leads with, what its customers say. */
function compCard(rv, byId, res) {
  const f = rv.adFacts;
  const same = f?.sameAs ? byId.get(f.sameAs) : null;
  const site = safeUrl(rv.website);
  const photo = safeUrl(rv.photo);
  const stat = (label, value, note, cls = "") => `<div class="cs ${cls}"><span class="k">${esc(label)}</span><span class="v">${value}</span><span class="n">${note ?? ""}</span></div>`;
  const own = (res.rivalAds ?? []).filter((a) => a.rival === rv.id);
  const longest = Math.max(0, ...own.filter((a) => a.channel === "meta").map((a) => a.days ?? 0));
  const lib = (which, label) => {
    if (!f) return stat(label, "–", "not checked", "muted");
    if (same) return stat(label, "↑", `same company as #${esc(same.rank)}`, "muted");
    if (f.unread?.includes(which)) return stat(label, "?", "couldn't read it", "unk");
    const n = which === "meta" ? f.meta : f.google;
    const more = which === "google" && f.googleMore ? "+" : "";
    if (!n) return stat(label, "0", "none running", "zero");
    return stat(label, `${num(n)}${more}`, which === "meta" && longest ? `longest ${num(longest)} days` : "running now");
  };
  let lsa = "";
  if (res.top?.shown) {
    const b = res.top.businesses.find((x) => x.rival === rv.id);
    lsa = b ? stat("Local Services Ads", `#${esc(b.position)}`, `of ${esc(res.top.businesses.length)} paying`) : stat("Local Services Ads", "0", "not paying for it", "zero");
  }
  const likes = f?.pageLikes ? stat("Facebook page", num(f.pageLikes), "likes") : "";
  const leads = [rv.adAngle ? `<div><b>Their ads</b>${esc(rv.adAngle)}</div>` : "", rv.promises ? `<div><b>Their site</b>${esc(rv.promises)}</div>` : ""].join("");
  const tags = [...(rv.complaints ?? []).map((c) => `<span class="tag">${esc(c)}</span>`), ...(rv.praisedFor ?? []).slice(0, 2).map((c) => `<span class="tag good">${esc(c)}</span>`)].join("");
  const theirAds = own.length && !same;
  const siteCard = res.sites?.[rv.id]?.read && !same;
  return `<article class="comp" id="comp-${esc(rv.id)}">
  <div class="cover"${photo ? "" : ` style="--h:${hueOf(rv.name)}"`}>${photo ? `<img src="${esc(photo)}" alt="" loading="lazy">` : ""}</div>
  <div class="comp-b">
    <div class="comp-h">${avatar(rv, "lg", { rank: rv.rank })}<div><h3>${esc(rv.name)}</h3><div class="meta">${rv.rating != null ? `${stars(rv.rating)} <b>${esc(rv.rating)}</b> · ` : ""}${rv.reviews != null ? `${num(rv.reviews)} reviews` : "no reviews"}${rv.category ? ` · ${esc(rv.category)}` : ""}</div></div></div>
    <div class="cstats">${lib("meta", "Facebook & Instagram ads")}${lib("google", "Google ads")}${lsa}${likes}</div>
    ${engineLine(rv)}
    ${leads ? `<div class="leads">${leads}</div>` : ""}
    ${tags ? `<div class="said-row"><span class="lab">Their customers say</span><div class="tags">${tags}</div>${rv.read ? `<span class="why">${num(rv.read)} reviews read, ${num(rv.low)} at 3★ or lower</span>` : ""}</div>` : rv.read ? `<div class="said-row"><span class="why">${num(rv.read)} reviews read, nothing that repeats</span></div>` : ""}
    <div class="comp-links">${theirAds ? `<a href="#ads" data-pick="${esc(rv.id)}">See their ${plural(own.length, "ad")} →</a>` : ""}${siteCard ? `<a href="#site-${esc(rv.id)}">Their website →</a>` : ""}${site ? `<a href="${esc(site)}" target="_blank" rel="noopener nofollow">Visit ${ICON.ext}</a>` : ""}</div>
  </div>
</article>`;
}

const engineLine = (rv) => (rv.engine ? `<p class="engine">${esc(rv.engine)}</p>` : "");

function postMock(a, business) {
  const name = business || "Your business";
  return `<article class="win">
  <div class="post">
    <div class="ph">${avatar({ name }, "md")}<div><div class="pn">${esc(name)}</div><div class="ps">Sponsored · ${platformMark("meta")}</div></div></div>
    <div class="pt">${esc(a.primaryText)}</div>
    <div class="creative">${a.theme ? `<span class="tag2">${esc(a.theme)}</span>` : ""}<div class="h">${esc(a.headline)}</div></div>
    <div class="pf"><div><div class="d">yourwebsite.com</div><div class="t">${esc(a.headline)}</div></div><span class="b">Learn more</span></div>
  </div>
  ${a.why ? `<div class="why">${esc(a.why)}</div>` : ""}
  ${a.needs ? `<div class="needs"><b>Only run it if</b> ${esc(onlyIf(a.needs))}</div>` : ""}
  <button class="copy" data-copy="${esc(`${a.headline}\n\n${a.primaryText}`)}">Copy the ad</button>
</article>`;
}

export function reportHtml(report) {
  const { input, result: res } = report;
  const byId = new Map(res.rivals.map((r) => [r.id, r]));
  const facts = Object.fromEntries(res.rivals.filter((r) => r.adFacts).map((r) => [r.id, r.adFacts]));
  const allAds = res.rivalAds ?? [];
  // Facebook and Instagram first (the creative people copy), then Google; the longest running first in each.
  const byAge = (a, b) => (b.days ?? -1) - (a.days ?? -1);
  const theirs = [...allAds.filter((a) => a.rival !== MARKET && a.channel === "meta").sort(byAge), ...allAds.filter((a) => a.rival !== MARKET && a.channel !== "meta").sort(byAge)];
  const market = allAds.filter((a) => a.rival === MARKET).sort(byAge);
  const totals = adTotals(allAds, facts);
  const longest = totals.longest ? allAds.find((a) => a.id === totals.longest.id) : null;
  const date = new Date(report.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const service = `${input.service[0].toUpperCase()}${input.service.slice(1)}`;
  const title = `${service} in ${input.location}`;
  const maxTheme = Math.max(1, ...res.themes.map((t) => t.count));
  const unreadMeta = Object.values(facts).some((f) => f.unread?.includes("meta"));
  const adCount = `${num(totals.meta + totals.google)}${totals.googleMore ? "+" : ""}`;
  const ctx = { ads: allAds, byId };

  const statCards = [
    ["rivals", "Competitors on Maps", `${res.rivals.length}`, `${totals.advertising} of them running ads`],
    ["ads", "Ads running now", adCount, `${num(totals.meta)} Facebook & Instagram · ${num(totals.google)}${totals.googleMore ? "+" : ""} Google`],
    ["watch", "Longest-running ad", longest ? `${num(longest.days)} days` : "–", longest ? `${whoOf(longest, byId)} (${CHANNEL[longest.channel]})` : "no dated ads"],
    ["weak", "Reviews read", `${num(res.readReviews)}`, res.readReviews ? `${num(res.lowReviews)} of them 3★ or lower` : "reviews were skipped"],
  ];

  // The filters: each choice with how many ads it holds.
  const count = (fn) => theirs.filter(fn).length;
  const pick = (f, v, label, n, extra = "") => `<button class="chip" data-f="${f}" data-v="${esc(v)}" aria-pressed="${v === "all"}">${extra}${label}<b>${num(n)}</b></button>`;
  const rivalPills = res.rivals
    .filter((r) => theirs.some((a) => a.rival === r.id))
    .map((r) => `<button class="rpill" data-f="rival" data-v="${esc(r.id)}" aria-pressed="false" title="${esc(r.name)}">${avatar(r, "xs")}<span>${esc(searchName(r.name))}</span><b>${num(count((a) => a.rival === r.id))}</b></button>`)
    .join("");
  const kinds = ["video", "image", "text"].filter((k) => theirs.some((a) => kindOf(a) === k));
  const channels = ["meta", "google"].filter((c) => theirs.some((a) => a.channel === c));
  const filters = theirs.length
    ? `<div class="filters" id="filters">
    <div class="f-row">
      <label class="search">${ICON.search}<input id="f-q" type="search" placeholder="Search their ads: an offer, a price, a word…" autocomplete="off" spellcheck="false"></label>
      <label class="tgl" title="Ads that have run 60 days or more: the ones that pay"><input type="checkbox" id="f-proven"><span class="sw"></span>Proven: 60+ days</label>
      <label class="sort">Sort<select id="f-sort"><option value="best">Facebook & Instagram first</option><option value="days">Longest running</option><option value="new">Newest first</option><option value="versions">Most versions</option></select></label>
    </div>
    <div class="f-row">
      ${channels.length > 1 ? `<div class="seg">${pick("channel", "all", "Everywhere", theirs.length)}${channels.map((c) => pick("channel", c, c === "meta" ? "Facebook & Instagram" : "Google", count((a) => a.channel === c), platformMark(c))).join("")}</div>` : ""}
      ${kinds.length > 1 ? `<div class="seg">${pick("kind", "all", "All kinds", theirs.length)}${kinds.map((k) => pick("kind", k, k === "text" ? "Search ads" : `${KIND[k]}s`, count((a) => kindOf(a) === k))).join("")}</div>` : ""}
    </div>
    <div class="f-row who"><button class="rpill" data-f="rival" data-v="all" aria-pressed="true"><span>All competitors</span><b>${num(theirs.length)}</b></button>${rivalPills}</div>
    <div class="f-meta"><span id="ad-count" aria-live="polite"></span><button class="link" id="f-clear" hidden>Clear filters</button></div>
  </div>`
    : "";

  const themes = res.themes
    .map(
      (t) => `<article class="card theme">
  <div>
    <div class="num">${num(t.count)}<small>${t.count === 1 ? "review" : "reviews"}</small></div>
    <h3>${esc(t.name)}</h3>
    <div class="meter"><i style="width:${Math.max(6, Math.round((t.count / maxTheme) * 100))}%"></i></div>
    <div class="spread">${t.rivals.map((id) => (byId.get(id) ? avatar(byId.get(id), "xs") : "")).join("")}<span>at ${plural(t.rivals.length, "competitor")}</span></div>
  </div>
  <div class="quotes">
    ${t.quotes.map((q) => `<blockquote>“${esc(q.text)}”<footer>${stars(q.stars)} ${avatar({ name: q.rivalName, logo: byId.get(q.rival)?.logo }, "xs")}<span>a customer of ${esc(q.rivalName)}</span></footer></blockquote>`).join("")}
    ${t.angle ? `<div class="angle"><b>Your angle</b><span>${esc(t.angle)}</span></div>` : ""}
  </div>
</article>`,
    )
    .join("");

  const offers = res.offers
    .map(
      (o) => `<article class="coupon">
  ${iconUrl("offers") ? `<img src="${iconUrl("offers")}" alt="">` : ""}
  <h3>${esc(o.offer)}</h3>
  ${o.why ? `<div class="why">${esc(o.why)}</div>` : ""}
  ${o.needs ? `<div class="needs"><b>Only offer it if</b> ${esc(onlyIf(o.needs))}</div>` : ""}
  <button class="copy" data-copy="${esc(o.offer)}">Copy the offer</button>
</article>`,
    )
    .join("");

  const viewerData = Object.fromEntries(
    allAds.map((a) => {
      const face = faceOf(a, byId);
      return [
        a.id,
        {
          who: whoOf(a, byId),
          logo: safeUrl(face.logo),
          initials: initials(face.name),
          hue: hueOf(face.name),
          channel: CHANNEL[a.channel],
          kind: KIND[a.kind] ?? a.kind,
          days: a.days,
          since: monthYear(a.startedAt),
          headline: a.headline,
          body: a.body,
          cta: a.cta,
          host: a.host,
          image: safeUrl(a.image),
          video: safeUrl(a.video),
          youtube: a.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(a.youtubeId) ? a.youtubeId : null,
          source: safeUrl(a.sourceUrl),
          link: safeUrl(a.link),
          versions: a.versions,
        },
      ];
    }),
  );

  const sections = [
    ["short", "Short version"],
    ...(res.changes ? [["changes", "What changed"]] : []),
    ...(res.card?.rows?.length ? [["engines", "How they get customers"]] : []),
    ["ads", "Their ads"],
    ["rivals", "Competitors"],
    ...(Object.keys(res.sites ?? {}).length ? [["sites", "Websites"]] : []),
    ...(res.themes.length ? [["weak", "Weak spots"]] : []),
    ...(res.ads.length ? [["win", "Ads that win"]] : []),
    ...(res.offers.length ? [["offers", "Offers"]] : []),
    ...(res.plan?.length ? [["plan", "30-day plan"]] : []),
    ...(res.unknowns?.length ? [["unknowns", "Couldn't see"]] : []),
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · ZuSpy competitor report</title>
<link rel="icon" href="${logoDataUrl()}">
<style>${STYLES}${UI_STYLES}${SECTION_STYLES}</style>
</head>
<body${report.anonymous ? ' class="anon"' : ""}>
${topbar(sections)}
<header class="hero"><div class="wrap">
  <div>
    <span class="eyebrow">Competitor report · ${esc(date)}${report.anonymous ? " · names hidden" : ""}</span>
    <h1>${esc(title)}</h1>
    <p class="sub">Who shows up first on Google Maps for “${esc(input.service)}”, how each one gets its customers, every ad they're running right now, and what ${num(res.readReviews || 0)} of their customers wrote about them${input.business ? `, for ${esc(input.business)}` : ""}.</p>
    <div class="vs"><span class="lab">Up against</span><div class="stack">${res.rivals.map((r) => `<a href="#comp-${esc(r.id)}" title="#${esc(r.rank)} ${esc(r.name)}">${avatar(r, "md")}</a>`).join("")}</div></div>
    <div class="facts"><span><b>${res.rivals.length}</b> competitors</span><span><b>${esc(adCount)}</b> ads running</span>${longest ? `<span>longest running <b>${num(longest.days)} days</b></span>` : ""}${res.readReviews ? `<span><b>${num(res.readReviews)}</b> reviews read</span>` : ""}</div>
  </div>
  <div class="cluster" aria-hidden="true"><img src="${iconUrl("ads")}" alt=""><img class="big" src="${logoDataUrl()}" alt=""><img src="${iconUrl("weak")}" alt=""><img src="${iconUrl("rivals")}" alt=""><img src="${iconUrl("win")}" alt=""></div>
</div></header>
<main class="wrap">
<section class="stats" aria-label="At a glance">${statCards.map(([icon, k, v, n]) => `<div class="card stat">${iconUrl(icon) ? `<img src="${iconUrl(icon)}" alt="">` : ""}<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="n">${esc(n)}</div></div></div>`).join("")}</section>

<section id="short" class="card verdict">
  <div>
    <span class="eyebrow">The short version</span>
    ${res.summary ? `<p class="big">${esc(res.summary)}</p>` : ""}
    ${res.theirAds ? `<p class="ads-line">${esc(res.theirAds)}</p>` : ""}
  </div>
  ${nextSteps(res, ctx)}
</section>

${changesSection(res, ctx)}

${scorecardSection(res, ctx)}

<section id="ads">
  ${heading("Their ads", "ads")}
  <p class="lead">Running right now, from Meta's Ad Library and Google's Ads Transparency Center, the longest running first: nobody keeps paying for an ad that doesn't work. Click any ad to see it big, then use the arrows to go through them.${unreadMeta ? " Some Facebook and Instagram searches couldn't be read this time; the competitor cards below say which." : ""}</p>
  ${theirs.length ? `<div class="adsbox">${filters}<div class="grid ads" id="ad-grid">${theirs.map((a, i) => adCard(a, byId, i)).join("")}</div><div class="card empty" id="no-ads" hidden>No ads match these filters. <button class="link" data-clear>Clear filters</button></div></div>` : `<div class="card empty">None of these competitors has an ad up on Facebook, Instagram or Google right now${unreadMeta ? " (some libraries couldn't be read this time)" : ""}. That's room for you.</div>`}
  ${topBlock(res, ctx, input)}
  ${market.length ? `<h3 class="subhead">Others in this market</h3><p class="lead">Businesses in the trade advertising on Facebook and Instagram for this search that aren't in the Maps top ${res.rivals.length}.</p><div class="grid ads">${market.map((a, i) => adCard(a, byId, i)).join("")}</div>` : ""}
</section>

<section id="rivals">
  ${heading("Who you're up against", "rivals")}
  <p class="lead">The first businesses on Google Maps for this search, in order: where each one advertises, what it leads with, and what its customers keep saying.</p>
  <div class="comps">${res.rivals.map((rv) => compCard(rv, byId, res)).join("")}</div>
</section>

${sitesSection(res, ctx)}

${
    res.themes.length
      ? `<section id="weak">
  ${heading("Their weak spots", "weak")}
  <p class="lead">What their customers complain about again and again, from ${plural(res.readReviews, "Google review")} (mostly their worst). Counted by code; every quote is a real customer's own sentence.</p>
  <div class="grid">${themes}</div>
  ${res.praise.length ? `<div class="praise"><span class="lab">What they get praised for:</span>${res.praise.map((p) => `<span class="tag good">${esc(p.name)} · ${num(p.count)}</span>`).join("")}</div>` : ""}
</section>`
      : ""
  }

${res.ads.length ? `<section id="win">${heading("Ads that win their customers", "win")}<p class="lead">Written for you: each one promises what theirs don't. None names a competitor, and each says what you must really do for it to be honest.</p><div class="grid wins">${res.ads.map((a) => postMock(a, input.business)).join("")}</div></section>` : ""}

${res.offers.length ? `<section id="offers">${heading("Offers to test", "offers")}<p class="lead">Built to take away the fear their customers wrote about.</p><div class="grid offers">${offers}</div></section>` : ""}

${planSection(res, ctx)}

${unknownsSection(res)}

<section id="how" class="card how">
  <h2>How this was made</h2>
  <div class="it"><span><b>Competitors:</b> a live Google Maps search for “${esc(input.service)} ${esc(input.location)}”, ads${input.business ? " and your own listing" : ""} left out.</span></div>
  <div class="it"><span><b>Ads:</b> Meta's Ad Library (${esc(report.meta_reader === "firecrawl" ? "read through Firecrawl" : report.meta_reader === "none" || report.meta_reader === "off" ? "skipped this time" : "read in a browser")}) and Google's Ads Transparency Center. Pictures and videos are saved with the report because the libraries' links expire.</span></div>
  ${res.readReviews ? `<div class="it"><span><b>Reviews:</b> each competitor's 30 lowest-rated and 10 most relevant Google reviews.</span></div>` : ""}
  ${Object.keys(res.sites ?? {}).length ? `<div class="it"><span><b>Websites:</b> each home page, the Google Tag Manager containers it loads, robots.txt and llms.txt, its sitemaps, and its home page about a year ago in the web archive.</span></div>` : ""}
  ${res.top ? `<div class="it"><span><b>Top of Google:</b> live Google searches in the town for Local Services Ads.</span></div>` : ""}
  ${res.card ? `<div class="it"><span><b>How each one gets customers:</b> scored by code from what was seen, never by the AI.</span></div>` : ""}
  <div class="it"><span><b>Analysis:</b> ${esc(report.ai ?? "an AI")}, then checked by code: counts come from the reviews it cites, quotes are rebuilt from the reviews' own sentences, and anything naming a competitor is dropped.</span></div>
  <div class="it"><span><b>What nobody can see from outside:</b> ad spend and results (only how long an ad has run), TikTok and Nextdoor ads (no public libraries), and ads run under a page name that doesn't match.${res.unknowns?.length ? ` <a href="#unknowns">The full list →</a>` : ""}</span></div>
  ${report.cost ? `<div class="it"><span><b>Cost of this report:</b> ${esc(costText(report.cost))}.</span></div>` : ""}
</section>

${ctaBlock()}
</main>
${footer()}

<dialog id="viewer" aria-label="Ad"><div class="viewer"><div class="vm" id="vm"></div><div class="vside"><div class="vbar"><button class="nav" aria-label="Previous ad" data-step="-1">${ICON.prev}</button><span id="vpos"></span><button class="nav" aria-label="Next ad" data-step="1">${ICON.next}</button><button class="x" aria-label="Close" data-close>×</button></div><div class="vb" id="vb"></div></div></div></dialog>
<script type="application/json" id="ad-data">${scriptJson(viewerData)}</script>
<script>
${TOC_SCRIPT}
(() => {
  const data = JSON.parse(document.getElementById("ad-data").textContent);
  const grid = document.getElementById("ad-grid");
  const state = { rival: "all", channel: "all", kind: "all", q: "", proven: false, sort: "best" };
  const q = document.getElementById("f-q");
  const proven = document.getElementById("f-proven");
  const sort = document.getElementById("f-sort");
  const count = document.getElementById("ad-count");
  const clear = document.getElementById("f-clear");
  const none = document.getElementById("no-ads");
  const cards = grid ? [...grid.querySelectorAll(".ad")] : [];
  const order = {
    best: (a, b) => Number(a.dataset.n) - Number(b.dataset.n),
    days: (a, b) => Number(b.dataset.days) - Number(a.dataset.days) || Number(a.dataset.n) - Number(b.dataset.n),
    new: (a, b) => Number(b.dataset.start) - Number(a.dataset.start) || Number(a.dataset.n) - Number(b.dataset.n),
    versions: (a, b) => Number(b.dataset.versions) - Number(a.dataset.versions) || Number(b.dataset.days) - Number(a.dataset.days),
  };
  function apply() {
    if (!grid) return;
    const words = state.q.toLowerCase().split(/\\s+/).filter(Boolean);
    let shown = 0;
    for (const el of [...cards].sort(order[state.sort])) {
      const ok = ["rival", "channel", "kind"].every((k) => state[k] === "all" || el.dataset[k] === state[k])
        && (!state.proven || Number(el.dataset.days) >= ${LONG_DAYS})
        && words.every((w) => el.dataset.q.includes(w));
      el.hidden = !ok;
      if (ok) shown++;
      grid.append(el);
    }
    if (count) count.textContent = shown + (shown === 1 ? " ad" : " ads") + (shown < cards.length ? " of " + cards.length : "");
    const active = state.rival !== "all" || state.channel !== "all" || state.kind !== "all" || state.q || state.proven;
    if (clear) clear.hidden = !active;
    if (none) none.hidden = shown > 0;
  }
  function choose(f, v) {
    state[f] = v;
    document.querySelectorAll('[data-f="' + f + '"]').forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.v === v)));
    apply();
  }
  document.querySelectorAll("#filters [data-f]").forEach((b) => b.addEventListener("click", () => choose(b.dataset.f, b.dataset.v)));
  if (q) q.addEventListener("input", () => ((state.q = q.value.trim()), apply()));
  if (proven) proven.addEventListener("change", () => ((state.proven = proven.checked), apply()));
  if (sort) sort.addEventListener("change", () => ((state.sort = sort.value), apply()));
  function reset() {
    state.q = ""; state.proven = false;
    if (q) q.value = "";
    if (proven) proven.checked = false;
    ["rival", "channel", "kind"].forEach((f) => choose(f, "all"));
  }
  if (clear) clear.addEventListener("click", reset);
  document.querySelectorAll("[data-clear]").forEach((b) => b.addEventListener("click", reset));
  // "See their ads" on a competitor's card: the ads, filtered to theirs.
  document.querySelectorAll("[data-pick]").forEach((a) => a.addEventListener("click", () => { reset(); choose("rival", a.dataset.pick); }));
  apply();

  const dlg = document.getElementById("viewer");
  const vm = document.getElementById("vm");
  const vb = document.getElementById("vb");
  let list = [];
  let at = -1;
  const el = (tag, attrs, text) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };
  function open(id, from) {
    const a = data[id];
    if (!a) return;
    // The arrows go through the ads in view, in the order they're shown.
    const box = from && from.closest(".grid");
    list = box ? [...box.querySelectorAll(".ad:not([hidden])")].map((c) => c.dataset.id) : [id];
    at = Math.max(0, list.indexOf(id));
    show();
    if (!dlg.open) dlg.showModal();
  }
  function show() {
    const a = data[list[at]];
    vm.replaceChildren();
    vb.replaceChildren();
    if (a.video) vm.append(el("video", { src: a.video, controls: "", autoplay: "", playsinline: "", poster: a.image }));
    else if (a.youtube && !document.body.classList.contains("anon")) vm.append(el("iframe", { src: "https://www.youtube-nocookie.com/embed/" + a.youtube, allow: "autoplay; encrypted-media", allowfullscreen: "" }));
    else if (a.image) vm.append(el("img", { src: a.image, alt: "" }));
    else vm.append(el("div", { class: "vm-words" }, a.headline || ""));
    const who = el("div", { class: "v-who" });
    const av = el("span", { class: "av av-md" + (a.logo ? " pic" : ""), style: a.logo ? null : "--h:" + a.hue });
    if (a.logo) av.append(el("img", { src: a.logo, alt: "" })); else av.textContent = a.initials;
    const nm = el("div");
    nm.append(el("b", null, a.who), el("span", null, a.channel));
    who.append(av, nm);
    vb.append(who);
    const pills = el("div", { class: "pills" });
    pills.append(el("span", { class: "pill" }, a.kind));
    if (a.days != null) pills.append(el("span", { class: "pill" + (a.days >= ${LONG_DAYS} ? " proven" : "") }, "Running " + a.days + " days" + (a.since ? " · since " + a.since : "")));
    if (a.versions > 1) pills.append(el("span", { class: "pill" }, a.versions + " versions"));
    vb.append(pills);
    if (a.headline) vb.append(el("div", { class: "hl" }, a.headline));
    if (a.body) vb.append(el("div", { class: "tx" }, a.body));
    if (a.cta) vb.append(el("div", { class: "why" }, "Button: " + a.cta));
    if (a.host) vb.append(el("div", { class: "why" }, "Sends people to " + a.host));
    const words = [a.headline, a.body].filter(Boolean).join("\\n\\n");
    if (words) {
      const b = el("button", { class: "copy" }, "Copy its words");
      b.addEventListener("click", () => copy(b, words));
      vb.append(b);
    }
    const links = el("div", { class: "links" });
    if (a.link) links.append(el("a", { href: a.link, target: "_blank", rel: "noopener nofollow" }, "Open the page it sends people to"));
    if (a.source) links.append(el("a", { href: a.source, target: "_blank", rel: "noopener" }, a.channel === "Google" ? "See it on Google's Ads Transparency Center" : "See it in Meta's Ad Library"));
    links.append(el("a", { href: ${JSON.stringify(ZUOPS_URL)}, target: "_blank", rel: "noopener", class: "why" }, "Turn this ad into yours in one click with Zuops →"));
    vb.append(links);
    document.getElementById("vpos").textContent = list.length > 1 ? (at + 1) + " of " + list.length : "";
    dlg.querySelectorAll(".nav").forEach((b) => (b.disabled = list.length < 2));
  }
  function step(d) {
    if (list.length < 2) return;
    at = (at + d + list.length) % list.length;
    show();
  }
  document.querySelectorAll(".ad").forEach((c) => {
    c.addEventListener("click", () => open(c.dataset.id, c));
    c.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open(c.dataset.id, c)));
  });
  document.querySelectorAll("[data-show]").forEach((a) => a.addEventListener("click", () => setTimeout(() => open(a.dataset.show, document.querySelector('.ad[data-id="' + a.dataset.show + '"]')), 250)));
  dlg.querySelectorAll("[data-step]").forEach((b) => b.addEventListener("click", () => step(Number(b.dataset.step))));
  dlg.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1); });
  dlg.addEventListener("close", () => vm.replaceChildren());
  dlg.addEventListener("click", (e) => (e.target === dlg || e.target.hasAttribute("data-close")) && dlg.close());
  function copy(btn, text) {
    const done = () => {
      const was = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = was), 1400);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => {});
  }
  document.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", (e) => (e.stopPropagation(), copy(b, b.dataset.copy))));

  // The 30-day plan's ticks are kept in this browser.
  const key = "zuspy-plan:" + document.title + ":" + ${JSON.stringify(report.created_at)};
  let done = {};
  try { done = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
  const boxes = [...document.querySelectorAll("[data-step-box]")];
  const tally = document.getElementById("plan-done");
  function count2() {
    if (tally) tally.textContent = boxes.filter((b) => b.checked).length + " of " + boxes.length + " done";
    boxes.forEach((b) => b.closest("li")?.classList.toggle("done", b.checked));
  }
  boxes.forEach((b) => {
    b.checked = !!done[b.dataset.stepBox];
    b.addEventListener("change", () => {
      done[b.dataset.stepBox] = b.checked;
      try { localStorage.setItem(key, JSON.stringify(done)); } catch {}
      count2();
    });
  });
  count2();
})();
</script>
</body>
</html>
`;
}

export function costText(cost) {
  const parts = [`DataForSEO $${Number(cost.dataforseo_usd ?? 0).toFixed(3)}`];
  if (cost.ai_tokens && Object.keys(cost.ai_tokens).length) {
    const tokens = Object.entries(cost.ai_tokens).map(([m, t]) => `${m} ${Math.round((t.input + t.output) / 1000)}k tokens`).join(", ");
    parts.push(cost.ai_usd_at_list_price == null ? tokens : `AI $${Number(cost.ai_usd_at_list_price).toFixed(3)} at Anthropic's list price (${tokens})`);
  } else if (cost.ai_plan_tokens) parts.push(`AI: ${Math.round((cost.ai_plan_tokens.input + cost.ai_plan_tokens.output) / 1000)}k tokens on your Claude plan`);
  else parts.push("AI: your Claude Code plan");
  if (cost.firecrawl_credits) parts.push(`${cost.firecrawl_credits} Firecrawl credits`);
  return parts.join(" · ");
}

export function reportMarkdown(report) {
  const { input, result: res } = report;
  const byId = new Map(res.rivals.map((r) => [r.id, r]));
  const L = [];
  L.push(`# ${input.service} in ${input.location}: competitor report`);
  L.push("");
  L.push(`${new Date(report.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · made with [ZuSpy](https://github.com/zutrue/zuspy)`);
  L.push("");
  if (res.summary) L.push(res.summary, "");
  if (res.theirAds) L.push(res.theirAds, "");
  for (const m of res.adMoves ?? []) L.push(`- ${m.move}${m.adId ? ` (ad ${m.adId})` : ""}`);
  if (res.adMoves?.length) L.push("");
  if (res.changes) {
    const since = new Date(res.changes.since).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    L.push(`## Since your last report (${since})`, "");
    if (!res.changes.items.length) L.push("Nothing changed in this market since then.");
    for (const c of res.changes.items) L.push(`- ${c.rival ? `**${md(byId.get(c.rival)?.name)}**: ` : ""}${md(c.text)}`);
    L.push("");
  }
  if (res.card?.rows?.length) {
    L.push("## How each one gets customers", "", "Scored by code from what was seen; ? = couldn't check this time.", "");
    L.push(`| Competitor | ${CHANNELS.map(([, label]) => label).join(" | ")} |`);
    L.push(`|---|${CHANNELS.map(() => "---").join("|")}|`);
    for (const row of res.card.rows) {
      const rv = byId.get(row.id);
      L.push(`| ${rv?.rank}. ${md(rv?.name)} | ${CHANNELS.map(([key]) => { const c = row.cells[key]; return md(c.state === "unknown" ? `? ${c.text}` : `${"●".repeat(c.dots)}${"○".repeat(3 - c.dots)} ${c.text}`); }).join(" | ")} |`);
    }
    L.push("");
    for (const rv of res.rivals) if (rv.engine) L.push(`- **${md(rv.name)}:** ${md(rv.engine)}`);
    if (res.rivals.some((rv) => rv.engine)) L.push("");
  }
  L.push("## Who you're up against", "");
  L.push("| # | Business | Rating | Facebook & Instagram ads | Google ads | Ads lead with |");
  L.push("|---|---|---|---|---|---|");
  for (const rv of res.rivals) {
    const f = rv.adFacts;
    const lib = (w) => (!f ? "" : f.sameAs ? `same as ${byId.get(f.sameAs)?.name ?? ""}` : f.unread?.includes(w) ? "couldn't read" : String(w === "meta" ? f.meta : `${f.google}${f.googleMore ? "+" : ""}`));
    L.push(`| ${rv.rank} | ${md(rv.name)} | ${rv.rating ?? "?"}★ (${rv.reviews ?? 0}) | ${lib("meta")} | ${lib("google")} | ${md(rv.adAngle ?? "")} |`);
  }
  L.push("");
  const ads = (res.rivalAds ?? []).filter((a) => a.rival !== MARKET).sort((a, b) => (b.days ?? -1) - (a.days ?? -1)).slice(0, 15);
  if (ads.length) {
    L.push("## Their longest-running ads", "");
    for (const a of ads) {
      const who = byId.get(a.rival)?.name ?? a.advertiser;
      L.push(`- **${md(who)}** · ${CHANNEL[a.channel]} ${KIND[a.kind] ?? a.kind}${a.days != null ? ` · running ${a.days} days` : ""}${a.headline ? ` · “${md(a.headline)}”` : ""}${a.body ? `: ${md(a.body.slice(0, 220))}` : ""}${a.sourceUrl ? ` ([source](${a.sourceUrl}))` : ""}`);
    }
    L.push("");
  }
  if (res.top?.shown) {
    L.push(`## Paying for the very top of Google (Local Services Ads, “${md(res.top.search)}”)`, "");
    for (const b of res.top.businesses) L.push(`${b.position}. **${md(b.name)}**${b.rival ? ` (#${byId.get(b.rival)?.rank} on Maps)` : ""} · ${b.rating ?? "?"}★, ${b.reviews ?? "?"} reviews${b.years ? `, ${b.years}+ years` : ""}${b.badges?.length ? ` · ${b.badges.map(md).join(", ")}` : ""}`);
    L.push("");
  }
  const siteList = res.rivals.filter((rv) => res.sites?.[rv.id]?.read && !rv.adFacts?.sameAs);
  if (siteList.length) {
    L.push("## Their websites", "");
    for (const rv of siteList) {
      const s = res.sites[rv.id];
      L.push(`### ${rv.rank}. ${md(rv.name)}`, "");
      if (s.headline || s.title) L.push(`- **Leads with:** ${md(s.headline ?? s.title)}`);
      if (s.yearAgo) L.push(`- **A year ago (${s.yearAgo.month}):** ${s.yearAgo.changed ? md(s.yearAgo.headline) : "the same headline"}${s.yearAgo.offers?.length ? `; offers then: ${s.yearAgo.offers.map(md).join(", ")}` : ""}`);
      if (s.offers.length) L.push(`- **Offers:** ${s.offers.map(md).join(" · ")}`);
      const tools = s.stack.filter((t) => t.group !== "builder");
      if (tools.length) L.push(`- **Tools:** ${tools.map((t) => `${md(t.name)}${t.hidden ? " (in Tag Manager)" : ""}`).join(", ")}`);
      if (s.pages) L.push(`- **Pages:** ${s.pages.total} pages, ${s.pages.towns.count} town pages, ${s.pages.blog.posts} posts (${s.pages.blog.fresh90} updated in 90 days)`);
      if (s.ai?.read) L.push(`- **AI assistants:** ${s.ai.answersBlocked ? `blocks ${s.ai.blocked.join(", ")}` : s.ai.blocked.length ? `answers open; blocks ${s.ai.blocked.join(", ")}` : "open to all"}${s.ai.llms ? "; has an llms.txt" : ""}`);
      if (s.socials.length) L.push(`- **Profiles:** ${s.socials.map((x) => (x.url ? `[${SOCIAL_LABEL[x.network] ?? x.network}](${x.url})` : SOCIAL_LABEL[x.network] ?? x.network)).join(", ")}`);
      if (s.phoneNote) L.push(`- **Phone:** site ${s.phoneNote.site}, Google ${s.phoneNote.google} (likely call tracking)`);
      L.push("");
    }
  }
  if (res.themes.length) {
    L.push("## Their weak spots", "");
    for (const t of res.themes) {
      L.push(`### ${t.name} (${t.count} reviews, ${t.rivals.length} competitors)`, "");
      for (const q of t.quotes) L.push(`> ${md(q.text)}`, `> — ${q.stars}★, a customer of ${md(q.rivalName)}`, "");
      if (t.angle) L.push(`**Your angle:** ${t.angle}`, "");
    }
  }
  if (res.ads.length) {
    L.push("## Ads that win their customers", "");
    for (const a of res.ads) L.push(`### ${a.headline}`, "", a.primaryText, "", `*Why:* ${a.why}${a.needs ? `  \n*Only run it if* ${onlyIf(a.needs)}` : ""}`, "");
  }
  if (res.offers.length) {
    L.push("## Offers to test", "");
    for (const o of res.offers) L.push(`- **${o.offer}**: ${o.why}${o.needs ? ` (only if ${onlyIf(o.needs)})` : ""}`);
    L.push("");
  }
  if (res.plan?.length) {
    L.push("## Your next 30 days", "");
    for (const w of [1, 2, 3, 4]) {
      const steps = res.plan.filter((p) => p.week === w);
      if (!steps.length) continue;
      L.push(`**Week ${w}**`, "");
      for (const p of steps) L.push(`- ${md(p.step)}`);
      L.push("");
    }
  }
  if (res.unknowns?.length) {
    L.push("## What ZuSpy couldn't see", "");
    for (const u of res.unknowns) L.push(`- **${md(u.what)}:** ${md(u.why)}${u.how ? ` ${md(u.how)}` : ""}${u.check ? ` [Check it](${u.check})` : ""}`);
    L.push("");
  }
  L.push("---", "", `Want this with one click, no API keys, and a weekly check on what changed? [Competitor Spy on Zuops](${ZUOPS_URL}).`, "");
  return L.join("\n");
}

const md = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();

export function renderReport(dir, report, { anonymous = false } = {}) {
  const r = anonymous ? anonymize(report) : report;
  const name = anonymous ? "report-anonymous" : "report";
  writeFileSync(join(dir, `${name}.html`), reportHtml(r));
  writeFileSync(join(dir, `${name}.md`), reportMarkdown(r));
  return join(dir, `${name}.html`);
}
