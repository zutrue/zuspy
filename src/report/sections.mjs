// The report's newer sections, drawn from report.json: what changed since the last report, how each competitor gets
// customers (the code-scored card), the very top of Google, their websites, a 30-day plan, and what couldn't be seen.
// Everything shown came from someone else's website, ad or review, so all of it is escaped.
import { CHANNELS, marketLines } from "../rules/scorecard.mjs";
import { FOLLOW_UP, SOCIAL_LABEL, undouble } from "../rules/site.mjs";
import { TOOL_GROUP_LABEL } from "../rules/watch.mjs";
import { esc, heading, plural, safeUrl } from "./html-kit.mjs";
import { avatar } from "./ui.mjs";
import { isBadge } from "../rules/google-top.mjs";

const num = (n) => Number(n).toLocaleString("en-US");
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");
const month = (ym) => (ym ? new Date(`${ym}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "");
const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
};

/** A chip that points at what a step or change is about: an ad (opens it), a competitor's site card, or the top of Google. */
export function refChip(ref, { ads, byId }) {
  const ad = ads.find((a) => a.id === ref);
  if (ad) return `<a class="ref" href="#ads" data-show="${esc(ad.id)}">${esc(ad.channel === "meta" ? "Their Facebook ad" : "Their Google ad")}${ad.days ? ` · ${num(ad.days)} days` : ""}</a>`;
  const r = byId.get(ref);
  if (r) return `<a class="ref who" href="#comp-${esc(r.id)}">${avatar(r, "xs")}<span>${esc(r.name)}</span></a>`;
  if (ref === "lsa") return `<a class="ref" href="#top">Top of Google</a>`;
  return "";
}

/** "Do this next" in the short version: the plan's first steps (or an older report's ad moves). */
export function nextSteps(res, ctx) {
  const steps = (res.plan ?? []).slice(0, 3);
  if (steps.length) {
    return `<div><h3>Do this next</h3><ol class="moves">${steps.map((p) => `<li><span>${esc(p.step)}${p.refs?.length ? `<span class="refs">${p.refs.map((r) => refChip(r, ctx)).join("")}</span>` : ""}</span></li>`).join("")}</ol>${(res.plan?.length ?? 0) > steps.length ? `<p class="more"><a href="#plan">The whole 30-day plan →</a></p>` : ""}</div>`;
  }
  const moves = (res.adMoves ?? []).map((m) => `<li><span>${esc(m.move)}${m.adId && ctx.ads.some((a) => a.id === m.adId) ? ` <a href="#ads" data-show="${esc(m.adId)}">See the ad →</a>` : ""}</span></li>`).join("");
  return moves ? `<div><h3>Do this next</h3><ol class="moves">${moves}</ol></div>` : "";
}

/** What changed since the last report on the same market. */
export function changesSection(res, ctx) {
  const ch = res.changes;
  if (!ch) return "";
  const groups = new Map();
  for (const c of ch.items) {
    const key = c.rival ?? "_";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const rows = [...groups]
    .sort(([a], [b]) => (ctx.byId.get(a)?.rank ?? 99) - (ctx.byId.get(b)?.rank ?? 99))
    .map(([id, list]) => {
      const r = ctx.byId.get(id);
      return `<div class="chg-row"><div class="chg-who">${r ? `${avatar(r, "md", { rank: r.rank })}<span>${esc(r.name)}</span>` : `<span class="out">Out of the top</span>`}</div><ul>${list.map((c) => `<li>${esc(c.text)}${c.ad ? ` <a href="#ads" data-show="${esc(c.ad)}">See the newest →</a>` : ""}</li>`).join("")}</ul></div>`;
    })
    .join("");
  const back = ch.folder && /^[A-Za-z0-9._-]+$/.test(ch.folder) ? ` <a href="../${esc(ch.folder)}/report.html">Open that report →</a>` : "";
  return `<section id="changes">
  ${heading(`Since your last report (${day(ch.since)})`, "changes")}
  <p class="lead">Found by code, comparing this report with the one from ${esc(day(ch.since))}: who moved on Google Maps, who started or stopped advertising, new ads, offers, headlines and tools.${back}</p>
  ${ch.items.length ? `<div class="card chg">${rows}</div>` : `<div class="card empty">Nothing changed in this market since then.</div>`}
</section>`;
}

const dotsHtml = (c) =>
  c.state === "unknown" ? `<span class="q" aria-label="couldn't check">?</span>` : `<span class="dots" aria-label="${c.dots} of 3">${[1, 2, 3].map((i) => `<i class="${c.state === "on" && i <= c.dots ? "f" : ""}"></i>`).join("")}</span>`;

/** How each one gets customers: the code-scored card, with the AI's one line per competitor under its name. */
export function scorecardSection(res, ctx) {
  const card = res.card;
  if (!card?.rows?.length) return "";
  const lines = marketLines(card, res.rivals);
  // Local Services Ads Google didn't show this time: one note instead of a column of question marks.
  const cols = CHANNELS.filter(([key]) => key !== "lsa" || card.rows.some((r) => r.cells.lsa?.state !== "unknown"));
  const SITE = ["site", "followup", "ai", "social"];
  const head = `<div class="sc-row sc-head"><div>Competitor</div>${cols.map(([, label]) => `<div>${esc(label)}</div>`).join("")}</div>`;
  const rows = card.rows
    .map((row) => {
      const r = ctx.byId.get(row.id);
      if (!r) return "";
      return `<div class="sc-row">
  <div class="sc-biz">${avatar(r, "md", { rank: r.rank })}<div><a class="name" href="#comp-${esc(r.id)}">${esc(r.name)}</a>${r.engine ? `<div class="eng">${esc(r.engine)}</div>` : ""}</div></div>
  ${(() => {
    // A site that didn't open: one cell across its four columns, not four question marks.
    const closed = SITE.every((k) => row.cells[k]?.state === "unknown" && row.cells[k].text === row.cells.site.text) && !/robots/.test(row.cells.site.text);
    return cols
      .filter(([key]) => !closed || !SITE.includes(key) || key === "site")
      .map(([key, label]) => {
        const c = row.cells[key];
        if (closed && key === "site") return `<div class="sc-cell unknown span">${dotsHtml(c)}<span class="t">${esc(c.text === "No website" ? "No website on its Google listing" : "Its website didn't open for a reader this time")}</span></div>`;
        return `<div class="sc-cell ${esc(c.state)}"><span class="lbl-m">${esc(label)}</span>${dotsHtml(c)}<span class="t">${esc(c.text)}</span></div>`;
      })
      .join("");
  })()}
</div>`;
    })
    .join("");
  return `<section id="engines">
  ${heading("How each one gets customers", "card")}
  <p class="lead">Scored by code from what was seen on their sites, in the ad libraries and on Google, never by the AI. Filled dots: they do it (more dots, harder). Empty: checked and not seen. <b>?</b>: couldn't check this time, which never means they don't.</p>
  ${lines.length ? `<div class="mkt">${lines.map((l) => `<span>${esc(l)}</span>`).join("")}</div>` : ""}
  <div class="sc" style="--cols:${cols.length}">${head}${rows}</div>
  ${cols.length < CHANNELS.length && res.top ? `<p class="why sc-note">Local Services Ads: Google showed none to our ${res.top.searches ? `${res.top.searches} ` : ""}searches this time, so that column is left out. <a href="#top">More →</a></p>` : ""}
</section>`;
}

/** Local Services Ads at the very top of Google (part of "Their ads"). */
export function topBlock(res, ctx, input) {
  const top = res.top;
  if (!top) return "";
  const search = esc(top.search ?? `${input.service} near me`);
  if (!top.shown) {
    return `<div id="top"><h3 class="subhead">The very top of Google</h3><div class="card note">Google showed no Local Services Ads (its “Sponsored”, Google-screened listings above the map) to our ${top.searches > 1 ? `${top.searches} searches` : "search"} for “${search}” this time. They rotate: search it on your phone in ${esc(input.location.split(",")[0])} to see who pays for the top.</div></div>`;
  }
  const cards = top.businesses
    .map((b) => {
      const r = b.rival ? ctx.byId.get(b.rival) : null;
      return `<article class="lsa-card${r ? " is-rival" : ""}">
  <span class="pos">${esc(b.position)}</span>
  <div class="nm">${r ? avatar(r, "sm") : avatar({ name: b.name }, "sm")}<span>${esc(b.name)}</span></div>
  <div class="meta">${b.rating != null ? `<span class="stars">★</span> ${esc(b.rating)}` : ""}${b.reviews != null ? ` · ${num(b.reviews)} reviews` : ""}${b.years ? ` · ${esc(b.years)}+ years` : ""}</div>
  ${(() => {
    // Reports made before badges were told apart from a distance or an address get the same check here.
    const badges = (b.badges ?? []).filter((x) => isBadge(x, input.location.split(",")[0]));
    return badges.length ? `<div class="tags">${badges.map((x) => `<span class="tag plain">${esc(x)}</span>`).join("")}</div>` : "";
  })()}
  <div class="who-tag">${r ? `<a href="#comp-${esc(r.id)}">#${esc(r.rank)} on Google Maps →</a>` : "Not in the Maps top"}</div>
</article>`;
    })
    .join("");
  const paid = top.paid?.length
    ? `<h3 class="subhead">Text ads on that search</h3><div class="grid paid">${top.paid.map((p) => `<div class="card"><div class="hl">${esc(p.title)}</div>${p.domain ? `<div class="why">${esc(p.domain)}</div>` : ""}<div class="tx">${esc(p.text)}</div></div>`).join("")}</div>`
    : "";
  return `<div id="top">
  <h3 class="subhead">Paying for the very top of Google</h3>
  <p class="lead">Local Services Ads: Google's “Sponsored” listings with its screened badge, above the map on a phone, paid per lead. From one search for “${search}” in ${esc(input.location)}, in Google's order. Their badges are what each one chose to show.</p>
  <div class="grid lsa">${cards}</div>
  ${paid}
</div>`;
}

const toolsLine = (site) => {
  const groups = new Map();
  for (const t of site.stack.filter((x) => x.group !== "builder")) {
    if (!groups.has(t.group)) groups.set(t.group, []);
    groups.get(t.group).push(t);
  }
  const order = ["ads", ...FOLLOW_UP, "email", "analytics"];
  return [...groups]
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([g, list]) => `<div class="tl"><span class="tg">${esc(TOOL_GROUP_LABEL[g] ?? g)}</span>${list.map((t) => `<span class="tool${t.hidden ? " hid" : ""}"${t.hidden ? ' title="Found only inside their Google Tag Manager container, not in the page\'s own code"' : ""}>${esc(t.name)}${t.hidden ? "<small>in Tag Manager</small>" : ""}</span>`).join("")}</div>`)
    .join("");
};

/** Their websites: what each one leads with now and a year ago, its tools, town pages, blog, AI access and profiles. */
export function sitesSection(res, ctx) {
  const sites = res.sites ?? {};
  if (!Object.keys(sites).length) return "";
  const cards = res.rivals
    .map((r) => {
      const s = sites[r.id];
      const same = r.adFacts?.sameAs ? ctx.byId.get(r.adFacts.sameAs) : null;
      const url = safeUrl(r.website);
      const head = `<div class="site-h">${avatar(r, "md", { rank: r.rank })}<div><div class="name">${esc(r.name)}</div>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener nofollow">${esc(hostOf(url) ?? "website")}</a>` : `<span class="why">${s?.read ? "Website (link hidden)" : "No website on Google"}</span>`}</div></div>`;
      if (same) return `<article class="card site" id="site-${esc(r.id)}">${head}<p class="why">Same website as #${esc(same.rank)} ${esc(same.name)}: see that one.</p></article>`;
      if (!s?.read) return `<article class="card site" id="site-${esc(r.id)}">${head}<p class="why">${r.website ? "Its site didn't open for a reader this time (a bot check or a slow site), so what's on it is unknown." : "It has no website on its Google listing."}</p></article>`;
      const kv = [];
      if (s.headline || s.title) kv.push(["Leads with", `“${esc(undouble(s.headline ?? s.title))}”`]);
      if (s.yearAgo) {
        const link = safeUrl(s.yearAgo.link);
        const then = s.yearAgo.changed ? `“${esc(undouble(s.yearAgo.headline))}”` : "The same headline";
        kv.push([
          "A year ago",
          `${then} <span class="why">(${esc(month(s.yearAgo.month))}${link ? `, <a href="${esc(link)}" target="_blank" rel="noopener">web archive</a>` : ""})</span>${s.yearAgo.offers?.length ? `<div class="tags gone">${s.yearAgo.offers.map((o) => `<span class="tag plain" title="On the site then, not now">${esc(o)}</span>`).join("")}</div>` : ""}`,
        ]);
      }
      if (s.offers.length) kv.push(["Offers on the site", `<div class="tags">${s.offers.map((o) => `<span class="tag good">${esc(o)}</span>`).join("")}</div>`]);
      const tools = toolsLine(s);
      if (tools) kv.push(["Tools", tools]);
      if (s.pages) {
        const p = s.pages;
        kv.push([
          "Pages",
          `${num(p.total)} pages · <b>${num(p.towns.count)}</b> town pages${p.towns.example ? ` <span class="why">(like ${esc(p.towns.example)})</span>` : ""} · ${p.blog.posts ? `${plural(p.blog.posts, "post")}, ${num(p.blog.fresh90)} updated in 90 days` : "no blog"}`,
        ]);
      }
      if (s.ai?.read) kv.push(["AI assistants", s.ai.answersBlocked ? `<span class="bad">Blocks ${esc(s.ai.blocked.join(", "))}</span>` : `${s.ai.blocked.length ? `Answers open; blocks ${esc(s.ai.blocked.join(", "))}` : "Open to all"}${s.ai.llms ? " · has an llms.txt" : ""}`]);
      if (s.socials.length) kv.push(["Profiles", `<div class="tags">${s.socials.map((x) => { const u = safeUrl(x.url); const label = esc(SOCIAL_LABEL[x.network] ?? x.network); return u ? `<a class="tag plain" href="${esc(u)}" target="_blank" rel="noopener nofollow">${label}</a>` : `<span class="tag plain">${label}</span>`; }).join("")}</div>`]);
      if (s.phoneNote) kv.push(["Phone", `Site: ${esc(s.phoneNote.site)} · Google: ${esc(s.phoneNote.google)} <span class="why">(different numbers: likely call tracking)</span>`]);
      return `<article class="card site" id="site-${esc(r.id)}">${head}<dl>${kv.map(([k, v]) => `<div class="kv"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("")}</dl></article>`;
    })
    .join("");
  return `<section id="sites">
  ${heading("Their websites", "sites")}
  <p class="lead">What each site shows beyond its ads: what it leads with now and a year ago (from the web archive), the tools behind it, including pixels hidden inside Google Tag Manager, its pages for each town, its blog, and whether AI assistants like ChatGPT may read it.</p>
  <div class="grid sites">${cards}</div>
</section>`;
}

/** Your next 30 days: the AI's plan, each step pointing at what it builds on. */
export function planSection(res, ctx) {
  const plan = res.plan ?? [];
  if (!plan.length) return "";
  const weeks = [1, 2, 3, 4]
    .map((w) => {
      const steps = plan.filter((p) => p.week === w);
      if (!steps.length) return "";
      return `<div class="week"><h3>Week ${w}</h3><ol>${steps.map((p) => `<li><label class="step"><input type="checkbox" data-step-box="${plan.indexOf(p)}"><span class="box" aria-hidden="true"></span><p>${esc(p.step)}</p></label>${p.refs?.length ? `<div class="refs">${p.refs.map((r) => refChip(r, ctx)).join("")}</div>` : ""}</li>`).join("")}</ol></div>`;
    })
    .join("");
  return `<section id="plan">
  ${heading("Your next 30 days", "plan")}
  <p class="lead">Built on what this report found, quickest wins first. Each step links to what it builds on; tick it off when it's done (kept in this browser). Budgets and results aren't promised: nobody outside a company can see what ads cost or bring in.</p>
  <div class="plan-bar"><span id="plan-done"></span></div>
  <div class="weeks">${weeks}</div>
</section>`;
}

/** What couldn't be seen this time, and how to check it. */
export function unknownsSection(res) {
  const list = res.unknowns ?? [];
  if (!list.length) return "";
  return `<section id="unknowns">
  ${heading("What ZuSpy couldn't see", "unknown")}
  <p class="lead">Unknown never means “they don't do it”. Here's what was out of sight this time, and how to check it yourself.</p>
  <div class="card unk"><ul>${list
    .map((u) => {
      const link = safeUrl(u.check);
      return `<li><b>${esc(u.what)}</b><span>${esc(u.why)}${u.how ? ` ${esc(u.how)}` : ""}</span>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener nofollow">Check it →</a>` : ""}</li>`;
    })
    .join("")}</ul></div>
</section>`;
}

export const SECTION_STYLES = `
/* what changed */
.chg{padding:6px 22px}
.chg-row{display:grid;grid-template-columns:minmax(200px,280px) minmax(0,1fr);gap:18px;padding:14px 0;border-top:1px solid var(--line)}
.chg-row:first-child{border-top:0}
.chg-who{display:flex;align-items:center;gap:12px;font-weight:700}
.chg-who .out{color:var(--muted)}
.chg ul{margin:0;padding-left:18px;display:grid;gap:4px;color:var(--ink-2)}
/* how each one gets customers */
.mkt{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}
.mkt span{background:#fff;border:1px solid var(--line);border-radius:999px;padding:6px 12px;font-size:13.5px;font-weight:600;color:var(--ink-2)}
.sc{background:#fff;border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden}
.sc-row{display:grid;grid-template-columns:minmax(210px,1.6fr) repeat(var(--cols,8),minmax(0,1fr));gap:10px;padding:16px 18px;border-top:1px solid var(--line);align-items:start}
.sc-cell.span{grid-column:span 4;flex-direction:row;align-items:center;gap:8px}
.sc-note{margin:10px 2px 0}
.sc-row:first-child{border-top:0}
.sc-head{background:#F7F9FC;font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);padding-top:12px;padding-bottom:12px;align-items:end}
.sc-biz{display:grid;grid-template-columns:40px 1fr;gap:14px;align-items:start}
.sc-biz .name{font-weight:700;font-size:15px;line-height:1.3;color:var(--ink)}
.sc-biz .eng{font-size:13px;color:var(--ink-2);margin-top:4px;line-height:1.45}
.sc-cell{display:flex;flex-direction:column;gap:5px;font-size:12.5px;line-height:1.35;color:var(--ink-2);min-width:0}
.sc-cell.off{color:var(--faint)}
.sc-cell.unknown{color:var(--amber-ink)}
.dots{display:flex;gap:4px}
.dots i{width:11px;height:11px;border-radius:999px;background:#E9EDF3}
.dots i.f{background:var(--blue)}
.q{display:grid;place-items:center;width:20px;height:20px;border-radius:999px;background:var(--amber-soft);color:var(--amber-ink);font-weight:800;font-size:12px}
/* the very top of Google */
.lsa{grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
.lsa-card{position:relative;background:#fff;border-radius:16px;box-shadow:var(--shadow);padding:16px 16px 14px 56px;display:flex;flex-direction:column;gap:6px}
.lsa-card.is-rival{box-shadow:var(--shadow),inset 0 0 0 2px var(--blue-line)}
.lsa-card .pos{position:absolute;left:16px;top:16px;display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:var(--blue-soft);color:var(--blue-ink);font-weight:800;font-size:13px}
.lsa-card .nm{display:flex;align-items:center;gap:9px;font-weight:700;line-height:1.3}
.lsa-card .meta{font-size:13px;color:var(--muted)}
.lsa-card .who-tag{font-size:12.5px;font-weight:600;color:var(--muted);margin-top:auto}
.note{color:var(--ink-2);font-size:14.5px}
.paid{grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.paid .hl{font-weight:700;color:var(--blue-ink)}.paid .tx{font-size:13.5px;color:var(--ink-2)}
/* their websites */
.sites{grid-template-columns:repeat(auto-fill,minmax(440px,1fr));align-items:start}
.site{scroll-margin-top:84px}
.site-h{display:grid;grid-template-columns:40px 1fr;gap:14px;align-items:center;margin-bottom:12px}
.site-h .name{font-weight:700;font-size:16px;line-height:1.3}
.site-h a{font-size:13px}
.site dl{margin:0;display:grid}
.kv{display:grid;grid-template-columns:120px minmax(0,1fr);gap:12px;padding:10px 0;border-top:1px solid var(--line);font-size:14px}
.kv dt{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);padding-top:2px}
.kv dd{margin:0;color:var(--ink-2);min-width:0;overflow-wrap:anywhere}
.kv .tags{margin-top:2px}
.tags.gone .tag{text-decoration:line-through;text-decoration-color:var(--faint)}
.tl{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:2px 0 6px}
.tg{font-size:12px;font-weight:700;color:var(--ink);margin-right:2px}
.tool{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;border-radius:8px;padding:3px 8px;background:#F2F4F7;color:var(--ink-2)}
.tool.hid{background:var(--blue-soft);color:var(--blue-ink)}
.tool small{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;opacity:.8}
.bad{color:#A8261B;font-weight:600}
a.tag:hover{text-decoration:none;background:var(--blue-soft);color:var(--blue-ink)}
/* the 30-day plan */
.weeks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;align-items:start}
.week{background:#fff;border-radius:var(--r);box-shadow:var(--shadow);padding:18px}
.week h3{margin:0 0 12px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--blue-ink)}
.week ol{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.week{min-width:0}.week ol{min-width:0}
.week li{background:#F7F9FC;border:1px solid var(--line);border-radius:14px;padding:12px 14px;min-width:0}
.week li p{margin:0;font-weight:500;font-size:14.5px;line-height:1.45}
.step{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start;cursor:pointer}
.step input{position:absolute;opacity:0;pointer-events:none}
.step .box{width:20px;height:20px;margin-top:1px;border-radius:6px;border:2px solid #C3CAD6;background:#fff;display:grid;place-items:center;transition:background .15s,border-color .15s}
.step input:checked + .box{background:var(--green);border-color:var(--green)}
.step input:checked + .box::after{content:"";width:6px;height:11px;border:solid #fff;border-width:0 2.5px 2.5px 0;transform:translate(0,-1px) rotate(45deg)}
.step input:focus-visible + .box{outline:2px solid var(--blue);outline-offset:2px}
.week li.done{background:var(--green-soft);border-color:#C8EBDB}
.week li.done p{color:var(--muted);text-decoration:line-through;text-decoration-color:rgba(11,138,95,.5)}
.week li .refs{margin-left:32px}
.plan-bar{margin:-6px 0 14px;font-size:13.5px;font-weight:700;color:var(--green)}
.refs{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.moves .refs{margin-top:6px}
.ref.who{display:inline-flex;align-items:center;gap:6px;padding:2px 10px 2px 2px}
.ref.who .av{border-radius:999px}.ref.who .av img{border-radius:999px}
.ref.who span{overflow:hidden;text-overflow:ellipsis}
.ref{font-size:12px;font-weight:700;border-radius:999px;padding:3px 9px;background:var(--blue-soft);color:var(--blue-ink);white-space:nowrap;max-width:100%;min-width:0;overflow:hidden;text-overflow:ellipsis}
.ref:hover{text-decoration:none;background:var(--blue-line)}
.more{margin:12px 0 0;font-weight:600}
/* what couldn't be seen */
.unk ul{list-style:none;margin:0;padding:0;display:grid}
.unk li{display:grid;grid-template-columns:minmax(200px,280px) minmax(0,1fr) auto;gap:16px;padding:12px 0;border-top:1px solid var(--line);font-size:14px;color:var(--ink-2);align-items:start}
.unk li:first-child{border-top:0;padding-top:0}
.unk li b{color:var(--ink)}
.unk li a{font-weight:700;white-space:nowrap}
@media (max-width:1100px){.sc-head{display:none}.sc-row{grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.sc-row .sc-biz{grid-column:1/-1}.sc-cell .lbl-m{display:block}.sc-cell.span{grid-column:1/-1}.weeks{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.sc-row{grid-template-columns:1fr 1fr}.sites{grid-template-columns:1fr}.kv{grid-template-columns:1fr;gap:4px}.weeks{grid-template-columns:1fr}.chg-row,.unk li{grid-template-columns:1fr;gap:6px}}
`;
