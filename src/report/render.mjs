// The spy report as a page (report.html, one file that opens in any browser) and as Markdown (report.md, for pasting
// into a doc or handing to an AI). Both come from report.json; `zuspy rebuild` draws them again.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { adTotals, MARKET, searchName } from "../rules/spy.mjs";
import { ctaBlock, esc, footer, heading, iconUrl, logoDataUrl, plural, safeUrl, scriptJson, STYLES, TOC_SCRIPT, topbar } from "./html-kit.mjs";
import { ZUOPS_URL } from "../config.mjs";

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
  "a an and the of at by in on for to all best local pro pros family quality affordable american national united premier elite top first 24 hour hours garage garages door doors gate gates repair repairs service services company co llc inc corp group roof roofs roofing plumbing plumber plumbers hvac heating cooling air ac med medical spa spas wellness aesthetics dental dentist electric electrical pest control lawn landscaping cleaning carpet pool pools solar home homes house painting window windows auto towing moving movers"
    .split(" "),
);
const PLACES = new Set(
  "alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada ohio oklahoma oregon pennsylvania tennessee texas utah vermont virginia washington wisconsin wyoming new north south east west san santa los las saint st fort mount lake"
    .split(" "),
);

/**
 * The ways a report's text may name a business: its full name, its name without a "| keywords" tail, its first two
 * words, and its first word when that word is its own ("A1", "Precision", "Darcy"), never a trade word or a place.
 */
export function nameAliases(name) {
  const base = searchName(String(name ?? ""));
  const words = base.split(/\s+/).filter(Boolean);
  const out = new Set([String(name ?? "").trim(), base]);
  if (words.length >= 3) out.add(words.slice(0, 2).join(" ").replace(/[,.]$/, ""));
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
  for (const [n, to] of market) for (const alias of nameAliases(n)) swaps.push([alias, to]);
  if (r.input.business) for (const alias of nameAliases(r.input.business)) swaps.push([alias, "your business"]);
  swaps.sort((a, b) => b[0].length - a[0].length);
  const patterns = swaps.map(([from, to]) => {
    const body = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    // One word ("Precision") only as that word, with its capital; a longer name in any case.
    return [new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, /\s/.test(from) ? "gi" : "g"), to];
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
    if (rv.adFacts) rv.adFacts = { ...rv.adFacts, metaUrl: null, googleUrl: null };
  }
  for (const a of r.result.rivalAds ?? []) {
    if (a.rival !== MARKET) a.advertiser = names.get(a.rival) ?? a.advertiser;
    a.sourceUrl = null;
    a.host = a.host ? "their-site.com" : null;
    a.link = null;
    a.youtubeId = null;
  }
  for (const t of r.result.themes) for (const q of t.quotes) q.rivalName = names.get(q.rival) ?? q.rivalName;
  if (r.input.business) r.input.business = "your business";
  // Which service ran the AI is the reader's own business: the model is enough.
  if (typeof r.ai === "string") r.ai = r.ai.replace(/\s*\(.*\)\s*$/, "");
  r.anonymous = true;
  return r;
}

const daysBadge = (d) =>
  d == null ? "" : `<span class="badge${d >= LONG_DAYS ? " proven" : ""}">${d >= LONG_DAYS ? `${num(d)} days running` : d >= 1 ? `${num(d)} ${d === 1 ? "day" : "days"}` : "New today"}</span>`;

/** One ad as a card: the picture (or its words), how long it has run, who runs it, its words and button. */
export function adCard(a, rivalsById, n) {
  const img = safeUrl(a.image);
  const video = safeUrl(a.video);
  const who = a.rival === MARKET ? a.advertiser : rivalsById.get(a.rival)?.name ?? a.advertiser;
  // Google shows a search ad as a picture of the ad: shown whole, top first, on white.
  const shot = a.channel === "google" && a.kind !== "video";
  const isVideo = !!(video || a.youtubeId || a.kind === "video");
  let media;
  if (img) media = `<img loading="lazy" src="${esc(img)}" alt="">`;
  else if (video) media = `<video preload="metadata" muted playsinline src="${esc(video)}#t=0.5"></video>`;
  else media = "";
  const mediaBox = media
    ? `<div class="media${shot ? " shot" : ""}">${media}<div class="badges">${daysBadge(a.days)}${a.versions > 1 ? `<span class="badge">${num(a.versions)} versions</span>` : ""}</div>${isVideo ? `<span class="badge play">▶ Video</span>` : ""}</div>`
    : `<div class="media words"><div class="badges">${daysBadge(a.days)}</div><div class="hl">${esc(a.headline ?? "")}</div><div class="tx">${esc(a.body ?? "")}</div></div>`;
  // A Meta headline is often just the page's name: shown once.
  const headline = a.headline && a.headline.trim().toLowerCase() !== String(who).trim().toLowerCase() ? a.headline : null;
  const words = media ? `${headline ? `<div class="hl">${esc(headline)}</div>` : ""}${a.body ? `<div class="tx">${esc(a.body)}</div>` : ""}` : "";
  return `<article class="ad" tabindex="0" data-id="${esc(a.id)}" data-rival="${esc(a.rival)}" data-channel="${esc(a.channel)}" data-kind="${esc(kindOf(a))}" data-n="${n}">
  ${mediaBox}
  <div class="body">
    <div class="who"><span class="dot ${esc(a.channel)}"></span><span class="n" title="${esc(who)}">${esc(who)}</span></div>
    ${words}
    <div class="foot">${a.cta ? `<span class="cta-chip">${esc(a.cta)}</span>` : `<span>${esc(KIND[a.kind] ?? a.kind)}${a.cards ? ` · ${num(a.cards)} cards` : ""}</span>`}<span class="host">${esc(a.channel === "meta" ? "Facebook & Instagram" : "Google")}</span></div>
  </div>
</article>`;
}

function libCell(f, which, label) {
  const head = `<span class="lbl-m">${esc(label)}</span>`;
  if (!f) return `<div>${head}<div class="lib zero">–</div></div>`;
  if (f.unread?.includes(which)) return `<div>${head}<div class="lib unread">Couldn't read it this time</div></div>`;
  const n = which === "meta" ? f.meta : f.google;
  const more = which === "google" && f.googleMore ? "+" : "";
  const url = safeUrl(which === "meta" ? f.metaUrl : f.googleUrl);
  const link = url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${n ? "See them →" : "Check →"}</a>` : "";
  return `<div>${head}<div class="lib${n ? "" : " zero"}">${n ? `${num(n)}${more}` : "None"}<small>${n ? "running now" : "running"}</small>${link ? `<small>${link}</small>` : ""}</div></div>`;
}

function rivalRow(rv, byId) {
  const f = rv.adFacts;
  const same = f?.sameAs ? byId.get(f.sameAs) : null;
  const site = safeUrl(rv.website);
  const libs = same
    ? `<div style="grid-column:span 2"><span class="lbl-m">Ads</span><div class="said">Same company as #${esc(same.rank)}: its ads are counted there.</div></div>`
    : `${libCell(f, "meta", "Facebook & Instagram")}${libCell(f, "google", "Google")}`;
  const leads = [
    rv.adAngle ? `<div><b>Ads:</b> ${esc(rv.adAngle)}</div>` : "",
    rv.promises ? `<div><b>Site:</b> ${esc(rv.promises)}</div>` : "",
    f?.tracking?.length && !same ? `<em>On its site: ${esc(f.tracking.join(", "))}</em>` : "",
  ].join("");
  const tags = [
    ...(rv.complaints ?? []).map((c) => `<span class="tag">${esc(c)}</span>`),
    ...(rv.praisedFor ?? []).slice(0, 2).map((c) => `<span class="tag good">${esc(c)}</span>`),
  ].join("");
  return `<div class="rt-row">
  <div class="biz"><span class="rank">${esc(rv.rank)}</span><div><div class="name">${esc(rv.name)}</div><div class="meta">${rv.rating != null ? `${stars(rv.rating)} ${esc(rv.rating)} · ` : ""}${rv.reviews != null ? `${num(rv.reviews)} reviews` : "no reviews"}${site ? ` · <a href="${esc(site)}" target="_blank" rel="noopener nofollow">website</a>` : ""}</div></div></div>
  ${libs}
  <div class="said"><span class="lbl-m">What they lead with</span>${leads || `<span class="why">Nothing to read</span>`}</div>
  <div class="cmp"><span class="lbl-m">What customers say</span>${tags ? `<div class="tags">${tags}</div>` : `<span class="why">${rv.read ? "Nothing that repeats" : "Reviews not read"}</span>`}${rv.read ? `<div class="why" style="margin-top:6px">${num(rv.read)} reviews read, ${num(rv.low)} at 3★ or lower</div>` : ""}</div>
</div>`;
}

function postMock(a, business) {
  const name = business || "Your business";
  const initials = name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "Y";
  return `<article class="win">
  <div class="post">
    <div class="ph"><span class="av">${esc(initials)}</span><div><div class="pn">${esc(name)}</div><div class="ps">Sponsored</div></div></div>
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

  const statCards = [
    ["rivals", "Competitors on Maps", `${res.rivals.length}`, `${totals.advertising} of them running ads`],
    ["ads", "Ads running now", adCount, `${num(totals.meta)} Facebook & Instagram · ${num(totals.google)}${totals.googleMore ? "+" : ""} Google`],
    ["watch", "Longest-running ad", longest ? `${num(longest.days)} days` : "–", longest ? `${byId.get(longest.rival)?.name ?? longest.advertiser} (${CHANNEL[longest.channel]})` : "no dated ads"],
    ["weak", "Reviews read", `${num(res.readReviews)}`, res.readReviews ? `${num(res.lowReviews)} of them 3★ or lower` : "reviews were skipped"],
  ];

  const moves = (res.adMoves ?? [])
    .map((m) => `<li><span>${esc(m.move)}${m.adId && allAds.some((a) => a.id === m.adId) ? ` <a href="#ads" data-show="${esc(m.adId)}">See the ad →</a>` : ""}</span></li>`)
    .join("");

  const rivalChips = res.rivals
    .filter((r) => theirs.some((a) => a.rival === r.id))
    .map((r) => `<button class="chip" data-f="rival" data-v="${esc(r.id)}" aria-pressed="false" title="${esc(r.name)}">#${esc(r.rank)} ${esc(r.name)}</button>`)
    .join("");
  const kinds = ["video", "image", "text"].filter((k) => theirs.some((a) => kindOf(a) === k));

  const themes = res.themes
    .map(
      (t) => `<article class="card theme">
  <div>
    <div class="num">${num(t.count)}<small>${t.count === 1 ? "review" : "reviews"}</small></div>
    <h3>${esc(t.name)}</h3>
    <div class="meter"><i style="width:${Math.max(6, Math.round((t.count / maxTheme) * 100))}%"></i></div>
    <div class="spread">at ${plural(t.rivals.length, "competitor")}</div>
  </div>
  <div class="quotes">
    ${t.quotes.map((q) => `<blockquote>“${esc(q.text)}”<footer>${stars(q.stars)} <span>a customer of ${esc(q.rivalName)}</span></footer></blockquote>`).join("")}
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
    allAds.map((a) => [
      a.id,
      {
        who: a.rival === MARKET ? a.advertiser : byId.get(a.rival)?.name ?? a.advertiser,
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
    ]),
  );

  const sections = [
    ["short", "The short version"],
    ["ads", "Their ads"],
    ["rivals", "Who you're up against"],
    ...(res.themes.length ? [["weak", "Weak spots"]] : []),
    ...(res.ads.length ? [["win", "Ads that win"]] : []),
    ...(res.offers.length ? [["offers", "Offers"]] : []),
    ["how", "How it's made"],
  ];

  const filters = theirs.length
    ? `<div class="toolbar">
    <div class="seg"><button class="chip" data-f="rival" data-v="all" aria-pressed="true">Everyone</button>${rivalChips}</div>
    <div class="seg"><button class="chip" data-f="channel" data-v="all" aria-pressed="true">Everywhere</button>${theirs.some((a) => a.channel === "meta") ? `<button class="chip" data-f="channel" data-v="meta" aria-pressed="false">Facebook & Instagram</button>` : ""}${theirs.some((a) => a.channel === "google") ? `<button class="chip" data-f="channel" data-v="google" aria-pressed="false">Google</button>` : ""}</div>
    ${kinds.length > 1 ? `<div class="seg"><button class="chip" data-f="kind" data-v="all" aria-pressed="true">All kinds</button>${kinds.map((k) => `<button class="chip" data-f="kind" data-v="${k}" aria-pressed="false">${esc(k === "text" ? "Search ads" : `${KIND[k]}s`)}</button>`).join("")}</div>` : ""}
    <span class="count" id="ad-count"></span>
  </div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)} · ZuSpy competitor report</title>
<link rel="icon" href="${logoDataUrl()}">
<style>${STYLES}</style>
</head>
<body${report.anonymous ? ' class="anon"' : ""}>
${topbar(sections)}
<header class="hero"><div class="wrap">
  <div>
    <span class="eyebrow">Competitor report · ${esc(date)}${report.anonymous ? " · names hidden" : ""}</span>
    <h1>${esc(title)}</h1>
    <p class="sub">Who shows up first on Google Maps for “${esc(input.service)}”, every ad they're running right now, and what ${num(res.readReviews || 0)} of their customers wrote about them${input.business ? `, for ${esc(input.business)}` : ""}.</p>
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
  ${moves ? `<div><h3>Do this next</h3><ol class="moves">${moves}</ol></div>` : ""}
</section>

<section id="ads">
  ${heading("Their ads", "ads")}
  <p class="lead">Running right now, from Meta's Ad Library and Google's Ads Transparency Center. Facebook and Instagram first, then Google, the longest running first: nobody keeps paying for an ad that doesn't work. Click any ad to see it big.${unreadMeta ? " Some Facebook and Instagram searches couldn't be read this time; the table below says which." : ""}</p>
  ${filters}
  ${theirs.length ? `<div class="grid ads" id="ad-grid">${theirs.map((a, i) => adCard(a, byId, i)).join("")}</div>` : `<div class="card empty">None of these competitors has an ad up on Facebook, Instagram or Google right now${unreadMeta ? " (some libraries couldn't be read this time)" : ""}. That's room for you.</div>`}
  ${market.length ? `<h3 class="subhead">Others in this market</h3><p class="lead">Businesses in the trade advertising on Facebook and Instagram for this search that aren't in the Maps top ${res.rivals.length}.</p><div class="grid ads">${market.map((a, i) => adCard(a, byId, i)).join("")}</div>` : ""}
</section>

<section id="rivals">
  ${heading("Who you're up against", "rivals")}
  <p class="lead">The first businesses on Google Maps for this search, in order: where each advertises, what it leads with, and what its customers keep saying.</p>
  <div class="rt">
    <div class="rt-row rt-head"><div>Business</div><div>Facebook & Instagram</div><div>Google</div><div>What they lead with</div><div>What customers say</div></div>
    ${res.rivals.map((rv) => rivalRow(rv, byId)).join("")}
  </div>
</section>

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

<section id="how" class="card how">
  <h2>How this was made</h2>
  <div class="it"><span><b>Competitors:</b> a live Google Maps search for “${esc(input.service)} ${esc(input.location)}”, ads${input.business ? " and your own listing" : ""} left out.</span></div>
  <div class="it"><span><b>Ads:</b> Meta's Ad Library (${esc(report.meta_reader === "firecrawl" ? "read through Firecrawl" : report.meta_reader === "none" || report.meta_reader === "off" ? "skipped this time" : "read in a browser")}) and Google's Ads Transparency Center. Pictures and videos are saved with the report because the libraries' links expire.</span></div>
  ${res.readReviews ? `<div class="it"><span><b>Reviews:</b> each competitor's 30 lowest-rated and 10 most relevant Google reviews.</span></div>` : ""}
  <div class="it"><span><b>Analysis:</b> ${esc(report.ai ?? "an AI")}, then checked by code: counts come from the reviews it cites, quotes are rebuilt from the reviews' own sentences, and anything naming a competitor is dropped.</span></div>
  <div class="it"><span><b>What nobody can see from outside:</b> ad spend and results (only how long an ad has run), TikTok ads (no public library for US advertisers), and ads run under a page name that doesn't match.</span></div>
  ${report.cost ? `<div class="it"><span><b>Cost of this report:</b> ${esc(costText(report.cost))}.</span></div>` : ""}
</section>

${ctaBlock()}
</main>
${footer()}

<dialog id="viewer"><button class="x" aria-label="Close" data-close>×</button><div class="viewer"><div class="vm" id="vm"></div><div class="vb" id="vb"></div></div></dialog>
<script type="application/json" id="ad-data">${scriptJson(viewerData)}</script>
<script>
${TOC_SCRIPT}
(() => {
  const data = JSON.parse(document.getElementById("ad-data").textContent);
  const grid = document.getElementById("ad-grid");
  const state = { rival: "all", channel: "all", kind: "all" };
  const count = document.getElementById("ad-count");
  function apply() {
    if (!grid) return;
    let shown = 0;
    grid.querySelectorAll(".ad").forEach((el) => {
      const ok = ["rival", "channel", "kind"].every((k) => state[k] === "all" || el.dataset[k] === state[k]);
      el.hidden = !ok;
      if (ok) shown++;
    });
    if (count) count.textContent = shown + (shown === 1 ? " ad" : " ads");
  }
  document.querySelectorAll(".toolbar .chip").forEach((b) =>
    b.addEventListener("click", () => {
      state[b.dataset.f] = b.dataset.v;
      document.querySelectorAll('.toolbar .chip[data-f="' + b.dataset.f + '"]').forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      apply();
    }),
  );
  apply();
  const dlg = document.getElementById("viewer");
  const vm = document.getElementById("vm");
  const vb = document.getElementById("vb");
  const el = (tag, attrs, text) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  };
  function open(id) {
    const a = data[id];
    if (!a) return;
    vm.replaceChildren();
    vb.replaceChildren();
    if (a.video) vm.append(el("video", { src: a.video, controls: "", autoplay: "", playsinline: "", poster: a.image }));
    else if (a.youtube && !document.body.classList.contains("anon")) vm.append(el("iframe", { src: "https://www.youtube-nocookie.com/embed/" + a.youtube, allow: "autoplay; encrypted-media", allowfullscreen: "" }));
    else if (a.image) vm.append(el("img", { src: a.image, alt: "" }));
    else vm.append(el("div", { style: "color:#fff;padding:30px;font-size:20px;font-weight:700" }, a.headline || ""));
    const who = el("div", { class: "who" });
    who.append(el("span", { class: "dot" + (a.channel === "Google" ? " google" : "") }), el("span", null, a.who + " · " + a.channel));
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
    dlg.showModal();
  }
  document.querySelectorAll(".ad").forEach((c) => {
    c.addEventListener("click", () => open(c.dataset.id));
    c.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open(c.dataset.id)));
  });
  document.querySelectorAll("[data-show]").forEach((a) => a.addEventListener("click", () => setTimeout(() => open(a.dataset.show), 250)));
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
  } else parts.push("AI: your Claude Code plan");
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
