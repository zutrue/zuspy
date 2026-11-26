// The page for one watched company (watch.html): what changed at every check, newest first, then what they're
// running now: their ads, their site's headline and offers, the pages their ads lead to, their tools and jobs.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pulseOf, TOOL_GROUP_LABEL, prettyPhone } from "../rules/watch.mjs";
import { adCard } from "./render.mjs";
import { ctaBlock, esc, footer, heading, iconUrl, logoDataUrl, plural, safeUrl, STYLES, TOC_SCRIPT, topbar } from "./html-kit.mjs";

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null);
const day = (iso) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const num = (n) => Number(n).toLocaleString("en-US");

const WATCH_STYLES = `
.timeline{display:grid;gap:16px}
.check{padding:24px}
.check h3{margin:0 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700}
.check h3.sub{margin-top:22px}
.change{display:grid;grid-template-columns:14px 1fr auto;gap:14px;padding:16px 0;border-top:1px solid var(--line);align-items:start}
.change:first-of-type{border-top:none}
.wdot{width:12px;height:12px;border-radius:999px;margin-top:6px;background:#CBD5E1}.wdot.w2{background:var(--blue)}.wdot.w3{background:var(--red)}
.change .t{font-weight:700;font-size:15.5px}.change .d{color:var(--ink-2);font-size:14px;margin-top:3px}
.change .ba{font-size:14px;margin-top:8px;display:grid;gap:4px}
.change .ba s{color:var(--muted)}.change .ba span{font-weight:600}
.change .w{color:var(--muted);font-size:13.5px;margin-top:6px}
.change img{width:96px;height:96px;object-fit:cover;border-radius:12px}
.facts2{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:16px}
.facts2 h3{margin:0 0 10px;font-size:17px;letter-spacing:-.01em}
.facts2 ul{margin:0;padding-left:18px;color:var(--ink-2)}.facts2 li{margin:4px 0}
dl.facts{display:grid;grid-template-columns:130px 1fr;gap:8px 12px;margin:0;font-size:14px}
dl.facts dt{color:var(--muted)}dl.facts dd{margin:0}
.stat .v.sm{font-size:22px}
`;

function changeRow(c) {
  const img = safeUrl(c.image);
  const link = safeUrl(c.link);
  return `<div class="change"><span class="wdot w${esc(Math.min(3, c.weight))}"></span><div>
    <div class="t">${esc(c.title)}${c.history ? ` <span class="pill">${esc(day(c.at))}</span>` : ""}</div>
    ${c.detail ? `<div class="d">${esc(c.detail)}</div>` : ""}
    ${c.before || c.after ? `<div class="ba"><s>${esc(c.before ?? "")}</s><span>${esc(c.after ?? "")}</span></div>` : ""}
    ${c.why ? `<div class="w">${esc(c.why)}</div>` : ""}
    ${link ? `<div class="w"><a href="${esc(link)}" target="_blank" rel="noopener nofollow">Open →</a></div>` : ""}
  </div>${img ? `<img loading="lazy" src="${esc(img)}" alt="">` : "<span></span>"}</div>`;
}

export function watchHtml(dir) {
  const watch = readJson(join(dir, "watch.json"));
  const snap = readJson(join(dir, "latest.json"));
  const folders = existsSync(join(dir, "checks")) ? readdirSync(join(dir, "checks")).sort().reverse() : [];
  const checks = folders.map((f) => ({ folder: f, changes: readJson(join(dir, "checks", f, "changes.json")) ?? [], snap: readJson(join(dir, "checks", f, "snapshot.json")) })).filter((c) => c.snap);
  const pulse = pulseOf(snap);
  const site = safeUrl(watch.website);
  const rivals = new Map([["c1", { id: "c1", name: watch.name }]]);
  const ads = [...(snap?.ads ?? [])].sort((a, b) => (a.channel === b.channel ? (b.days ?? -1) - (a.days ?? -1) : a.channel === "meta" ? -1 : 1));
  const f = snap?.adFacts;
  const lib = (w) => (!f ? "–" : f.unread.includes(w) ? "not read" : `${num(w === "meta" ? f.meta : f.google)}${w === "google" && f.googleMore ? "+" : ""}`);
  const fresh = checks.flatMap((c) => c.changes.filter((x) => !x.history));
  const stats = [
    ["ads", "Facebook & Instagram ads", lib("meta"), "running now"],
    ["ads", "Google ads", lib("google"), "running now"],
    ["watch", "Longest-running ad", pulse?.longest ? `${num(pulse.longest)} days` : "–", "still running"],
    ["rivals", "Changes spotted", `${fresh.length}`, `over ${plural(checks.length, "check")}`],
  ];

  const timeline = checks
    .map((c, i) => {
      const now = c.changes.filter((x) => !x.history);
      const old = c.changes.filter((x) => x.history);
      const first = i === checks.length - 1;
      const head = first ? `First check · ${day(c.snap.at)}` : `${day(c.snap.at)} · ${now.length ? plural(now.length, "change") : "no changes"}`;
      return `<article class="card check"><h3>${esc(head)}</h3>
      ${now.map(changeRow).join("")}
      ${first && !now.length ? `<div class="d" style="color:var(--ink-2)">Their starting point: ${plural(c.snap.ads.length, "ad")}, ${plural(c.snap.site?.offers.length ?? 0, "offer")} on their site${c.snap.pages ? `, ${num(c.snap.pages.total)} pages` : ""}. Check again later to see what changes.</div>` : ""}
      ${old.length ? `<h3 class="sub">Their last year, from the web archive and certificate records</h3>${old.map(changeRow).join("")}` : ""}
    </article>`;
    })
    .join("");

  const s = snap?.site;
  const groups = {};
  for (const t of s?.tools ?? []) (groups[t.group] ??= []).push(t.hidden ? `${t.name} (in Tag Manager)` : t.name);
  const landings = (snap?.landings ?? []).filter((l) => l.read);
  const sections = [["changes", "What changed"], ["ads", "Their ads now"], ["site", "Their website"]];

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>${esc(watch.name)} · ZuSpy watch</title><link rel="icon" href="${logoDataUrl()}"><style>${STYLES}${WATCH_STYLES}</style></head><body>
${topbar(sections)}
<header class="hero"><div class="wrap">
  <div>
    <span class="eyebrow">Watching · since ${esc(day(watch.added_at))}</span>
    <h1>${esc(watch.name)}</h1>
    <p class="sub">${site ? `<a href="${esc(site)}" target="_blank" rel="noopener nofollow">${esc(watch.host)}</a> · ` : ""}${plural(checks.length, "check")}, the last on ${esc(day(watch.last_check))}. Every change below was found by comparing one check with the one before.</p>
    <div class="facts">${snap?.listing?.rating != null ? `<span>Google <b>${esc(snap.listing.rating)}★</b> from <b>${num(snap.listing.reviews ?? 0)}</b> reviews</span>` : ""}<span><b>${num(pulse?.offers ?? 0)}</b> offers on their site</span>${pulse?.pages != null ? `<span><b>${num(pulse.pages)}</b> pages</span>` : ""}<span>${pulse?.jobs == null ? "no public job board" : `<b>${num(pulse.jobs)}</b> open jobs`}</span></div>
  </div>
  <div class="cluster" aria-hidden="true"><img src="${iconUrl("ads")}" alt=""><img class="big" src="${logoDataUrl()}" alt=""><img src="${iconUrl("watch")}" alt=""><img src="${iconUrl("rivals")}" alt=""><img src="${iconUrl("offers")}" alt=""></div>
</div></header>
<main class="wrap">
<section class="stats">${stats.map(([icon, k, v, n]) => `<div class="card stat"><img src="${iconUrl(icon)}" alt=""><div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div><div class="n">${esc(n)}</div></div></div>`).join("")}</section>
<section id="changes">${heading("What changed", "watch")}<p class="lead">Newest first. A library or page that couldn't be read says nothing, so "stopped" always means stopped. Red: worth acting on; blue: worth a look.</p><div class="timeline">${timeline}</div></section>
<section id="ads">${heading("Their ads now", "ads")}<p class="lead">Facebook and Instagram first, then Google, the longest running first.</p>${ads.length ? `<div class="grid ads">${ads.map((a, i) => adCard(a, rivals, i)).join("")}</div>` : `<div class="card empty">No ads running in the libraries that could be read.</div>`}</section>
<section id="site">${heading("Their website", "rivals")}
<div class="facts2">
  <div class="card"><h3>What it leads with</h3>${s?.headline ? `<p style="margin:0 0 8px;font-weight:700;font-size:16px">${esc(s.headline)}</p>` : ""}${s?.description ? `<p class="why" style="margin:0">${esc(s.description)}</p>` : ""}${!s ? `<p class="why">Their home page couldn't be read.</p>` : ""}</div>
  <div class="card"><h3>Offers on the page</h3>${s?.offers?.length ? `<ul>${s.offers.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : `<p class="why">None found.</p>`}</div>
  <div class="card"><h3>Tools in its source</h3>${Object.keys(groups).length ? `<dl class="facts">${Object.entries(groups).map(([g, names]) => `<dt>${esc(TOOL_GROUP_LABEL[g] ?? g)}</dt><dd>${esc(names.join(", "))}</dd>`).join("")}</dl>` : `<p class="why">None found (a tag manager can hide them).</p>`}${s?.phones?.length ? `<p class="why" style="margin:12px 0 0">Phone numbers: ${esc(s.phones.map(prettyPhone).join(", "))}</p>` : ""}</div>
  ${landings.length ? `<div class="card"><h3>Where their ads send people</h3><ul>${landings.map((l) => `<li><a href="${esc(safeUrl(l.url) ?? "#")}" target="_blank" rel="noopener nofollow">${esc(l.headline ?? l.title ?? l.host)}</a> <span class="why">(${plural(l.ads, "ad")}${l.own ? "" : ", not on their main site"}${l.formFields ? `, a ${l.formFields}-box form` : ""})</span></li>`).join("")}</ul></div>` : ""}
  ${snap?.jobs ? `<div class="card"><h3>Hiring (${esc(snap.jobs.total)} open)</h3><ul>${snap.jobs.roles.slice(0, 10).map((r) => `<li>${esc(r.title)}${r.location ? ` <span class="why">${esc(r.location)}</span>` : ""}</li>`).join("")}</ul></div>` : ""}
</div></section>
${ctaBlock()}
</main>${footer()}
<script>${TOC_SCRIPT}
document.querySelectorAll(".ad").forEach((c) => c.addEventListener("click", () => { const m = c.querySelector("img,video"); if (m) window.open(m.getAttribute("src"), "_blank"); }));</script>
</body></html>`;
}

export function renderWatch(dir) {
  const file = join(dir, "watch.html");
  writeFileSync(file, watchHtml(dir));
  return file;
}
