// What a competitor's website says about how it gets and keeps customers, beyond its ads: the tools it runs (including
// the pixels it hides inside Google Tag Manager), the AI assistants it lets read it, its pages for each town, its blog,
// the profiles it links to, the offers on its home page, and how that page read a year ago. Pure rules: site-check.mjs
// does the reading. Every fact is something a page or file showed; anything not read stays unknown, never "none".
import { offersIn, pageChunks, phonesIn, prettyPhone, siteFacts, siteTools, TOOL_GROUP_LABEL } from "./watch.mjs";

/** Google Tag Manager containers read per site. */
export const MAX_CONTAINERS = 2;

/** The Google Tag Manager containers a page loads ("GTM-ABC123"). */
export function gtmIds(html) {
  return [...new Set([...String(html ?? "").matchAll(/\bGTM-[A-Z0-9]{4,9}\b/g)].map((m) => m[0]))].slice(0, MAX_CONTAINERS);
}

/** A container's code with its escapes undone, so a pixel's snippet reads as it would on a page. */
export function containerText(js) {
  return String(js ?? "")
    .replace(/\\\//g, "/")
    .replace(/\\u003c/gi, "<")
    .replace(/\\u003e/gi, ">")
    .replace(/\\u0026/gi, "&")
    .replace(/\\x3c/gi, "<")
    .replace(/\\x3e/gi, ">")
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

// Google's own tag types inside a container (no snippet to match, only the type's code name).
const TEMPLATES = [
  [/"function":"__(?:awct|sp|gclidw|awud|awec)"/, "Google Ads tag", "ads"],
  [/"function":"__baut"/, "Microsoft Ads tag", "ads"],
  [/"function":"__(?:flc|fls)"/, "Google display ads tag", "ads"],
  [/"function":"__hjtc"/, "Hotjar", "analytics"],
];

/** The tools a Tag Manager container loads. A site builder named in a container isn't the site's own. */
export function containerTools(js) {
  const text = containerText(js);
  const found = siteTools(text).filter((t) => t.group !== "builder" && t.name !== "Google Tag Manager");
  for (const [re, name, group] of TEMPLATES) if (re.test(text) && !found.some((t) => t.name === name)) found.push({ name, group });
  return found;
}

const GROUP_ORDER = Object.keys(TOOL_GROUP_LABEL);

/** One list of a site's tools; `hidden` marks the ones found only inside Tag Manager (not in the page's own code). */
export function stackOf(pageTools, containers = []) {
  const out = pageTools.map((t) => ({ name: t.name, group: t.group, hidden: false }));
  for (const c of containers) for (const t of c) if (!out.some((x) => x.name === t.name)) out.push({ name: t.name, group: t.group, hidden: true });
  return out.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
}

// ---------------------------------------------------------------------------------------------------------------------
// AI assistants
// ---------------------------------------------------------------------------------------------------------------------

/** The crawlers that read a site for AI answers or training, and what a business owner knows them as. */
export const AI_CRAWLERS = [
  ["OAI-SearchBot", "ChatGPT search", "answers"],
  ["ChatGPT-User", "ChatGPT", "answers"],
  ["PerplexityBot", "Perplexity", "answers"],
  ["Claude-SearchBot", "Claude search", "answers"],
  ["Claude-User", "Claude", "answers"],
  ["GPTBot", "OpenAI's training", "training"],
  ["ClaudeBot", "Anthropic's training", "training"],
  ["Google-Extended", "Gemini's training", "training"],
  ["Applebot-Extended", "Apple Intelligence", "training"],
];

/** robots.txt: its sitemaps, and for each AI crawler whether it is blocked, allowed or not named. */
export function robotsFacts(txt) {
  const text = String(txt ?? "");
  const sitemaps = [...text.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 10);
  const groups = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const l = line.replace(/#.*/, "").trim();
    const ua = l.match(/^user-agent:\s*(.+)$/i);
    if (ua) {
      if (!cur || cur.rules.length) groups.push((cur = { agents: [], rules: [] }));
      cur.agents.push(ua[1].trim().toLowerCase());
      continue;
    }
    const rule = l.match(/^(dis)?allow:\s*(.*)$/i);
    if (rule && cur) cur.rules.push(`${rule[1] ? "D" : "A"}${rule[2].trim()}`);
  }
  const shuts = (g) => g.rules.includes("D/") && !g.rules.includes("A/");
  const everyone = groups.find((g) => g.agents.includes("*"));
  const bots = {};
  for (const [name] of AI_CRAWLERS) {
    const g = groups.find((x) => x.agents.includes(name.toLowerCase()));
    bots[name] = g ? (shuts(g) ? "blocked" : "allowed") : everyone && shuts(everyone) ? "blocked" : "unspecified";
  }
  return { sitemaps, bots, closed: !!everyone && shuts(everyone) };
}

/** What AI assistants may read: the ones it blocks (answer bots first), and whether it publishes an llms.txt. */
export function aiAccess(robots, llms) {
  if (!robots) return { read: false, llms: !!llms, blocked: [], answersBlocked: false };
  const blocked = AI_CRAWLERS.filter(([name]) => robots.bots[name] === "blocked");
  return {
    read: true,
    llms: !!llms,
    blocked: blocked.map(([, label]) => label),
    answersBlocked: blocked.some(([, , kind]) => kind === "answers"),
  };
}

/** A robots.txt or llms.txt answer that is really the site's 404 page or home page. */
export const isHtml = (text) => /^\s*(<!doctype|<html|<head|<body)/i.test(String(text ?? "").slice(0, 400));

// ---------------------------------------------------------------------------------------------------------------------
// Pages: towns and the blog
// ---------------------------------------------------------------------------------------------------------------------

/** A sitemap's entries (address and last change) and, for an index, the sitemaps it lists. */
export function sitemapEntries(xml) {
  const text = String(xml ?? "");
  const loc = (part) => part.match(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)/i)?.[1]?.replace(/&amp;/g, "&") ?? null;
  if (/<sitemapindex[\s>]/i.test(text)) return { urls: [], children: [...text.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/gi)].map((m) => loc(m[1])).filter(Boolean) };
  const urls = [...text.matchAll(/<url>([\s\S]*?)<\/url>/gi)]
    .map((m) => ({ loc: loc(m[1]), lastmod: m[1].match(/<lastmod>\s*([^<\s]+)/i)?.[1] ?? null }))
    .filter((u) => u.loc);
  return { urls, children: [] };
}

const STATES = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california", co: "colorado", ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia",
  hi: "hawaii", id: "idaho", il: "illinois", in: "indiana", ia: "iowa", ks: "kansas", ky: "kentucky", la: "louisiana", me: "maine", md: "maryland",
  ma: "massachusetts", mi: "michigan", mn: "minnesota", ms: "mississippi", mo: "missouri", mt: "montana", ne: "nebraska", nv: "nevada", nh: "new hampshire", nj: "new jersey",
  nm: "new mexico", ny: "new york", nc: "north carolina", nd: "north dakota", oh: "ohio", ok: "oklahoma", or: "oregon", pa: "pennsylvania", ri: "rhode island", sc: "south carolina",
  sd: "south dakota", tn: "tennessee", tx: "texas", ut: "utah", vt: "vermont", va: "virginia", wa: "washington", wv: "west virginia", wi: "wisconsin", wy: "wyoming", dc: "district of columbia",
};
export const stateName = (abbr) => STATES[String(abbr ?? "").toLowerCase()] ?? null;
const STATE_SLUGS = new Set([...Object.keys(STATES).filter((s) => !["in", "me", "or", "oh", "hi", "ok", "co", "de", "la", "ma", "pa", "id", "al", "ms", "ne", "mt", "wa", "va", "ct", "ga", "mi", "sc", "nd", "sd", "md"].includes(s)), ...Object.values(STATES).map((n) => n.replace(/\s+/g, "-"))]);

// Folders that hold a page per town or area.
const TOWN_FOLDER = /^(service-areas?|areas?|areas-we-serve|areas-served|service-area-pages|locations?|cities|communities|near-me|where-we-work|serving|we-serve)$/;
// Slug endings that are about the work, not a place.
const NOT_A_PLACE = new Set("cost costs price prices pricing near me tips guide guides faq faqs services service company companies contractor contractors emergency commercial residential repair repairs installation install replacement new parts spring springs opener openers maintenance inspection estimate estimates financing reviews blog about contact specials coupons warranty door doors garage gate gates spring springs cable cables panel panels track tracks roller rollers window windows drain drains water heater heaters sewer leak leaks ac air furnace duct ducts system systems unit units home homes house same day 24 hour hours best top affordable cheap local professional certified licensed".split(" "));

/** A word's stem for matching a service to a page's address: "plumber" and "plumbing" both "plum". */
const stem = (w) => (w.length >= 4 ? w.slice(0, 4) : w);
/** The stems of a service's words, for spotting "/garage-door-repair-mesa" style pages. */
const serviceWords = (service) => [...new Set(String(service ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3).map(stem))];
const LINK_WORDS = new Set(["and", "in", "near", "for", "the", "of", "to"]);

/**
 * "garage-door-repair-mesa" or "mesa-garage-door-repair" -> its shape ("garage-door-repair-*"), when the page's address
 * is every word of the service plus one or two words that aren't about the work. Null otherwise.
 */
export function townShape(slug, words) {
  if (!words.length) return null;
  const bits = slug.split("-").filter(Boolean);
  // "garage-door-repair-mesa-az": the state on the end isn't part of the shape.
  if (bits.length > 2 && STATE_SLUGS.has(bits.at(-1))) bits.pop();
  const work = (b) => words.includes(stem(b)) || NOT_A_PLACE.has(b) || LINK_WORDS.has(b);
  const hasService = (part) => words.every((w) => part.some((b) => stem(b) === w));
  const place = (part) => part.length >= 1 && part.length <= 2 && !part.some((b) => work(b) || /^\d+$/.test(b) || b.length < 3);
  let i = 0;
  while (i < bits.length && work(bits[i])) i++;
  if (i > 0 && hasService(bits.slice(0, i)) && place(bits.slice(i))) return `${bits.slice(0, i).join("-")}-*`;
  let j = bits.length;
  while (j > 0 && work(bits[j - 1])) j--;
  if (j < bits.length && hasService(bits.slice(j)) && place(bits.slice(0, j))) return `*-${bits.slice(j).join("-")}`;
  return null;
}

/**
 * What a site's pages show: how many there are, how many are pages for a town or area (the classic way a local
 * business ranks in every suburb), and how many blog posts it has, with how many changed in the last 90 days.
 */
export function sitePages(entries, { service, now = Date.now() } = {}) {
  const seen = new Map();
  for (const e of entries) {
    try {
      const u = new URL(e.loc);
      const path = (u.pathname.replace(/\/+$/, "") || "/").toLowerCase();
      if (/\.(jpe?g|png|gif|webp|svg|pdf|xml)$/.test(path)) continue;
      if (!seen.has(path)) seen.set(path, e);
    } catch {
      /* not an address */
    }
  }
  if (!seen.size) return null;
  const words = serviceWords(service);
  const towns = new Set();
  let townExample = null;
  const blog = [];
  const families = new Map();
  const prefixes = new Map();
  for (const [path, e] of seen) {
    const parts = path.split("/").filter(Boolean);
    const family = parts.length > 1 ? `/${parts[0]}` : "(top pages)";
    families.set(family, (families.get(family) ?? 0) + 1);
    const last = parts.at(-1) ?? "";
    if (!e.town && (e.post || /^(blog|news|articles?|tips|resources|learn|guides?|posts?|insights)$/.test(parts[0] ?? ""))) {
      if (parts.length > 1 || e.post) blog.push(e);
      continue;
    }
    // A town and its state ("mesa-az", "lake-havasu-city-arizona"): short, so a news post ending in a state isn't one.
    const bits = last.split("-");
    const stateEnd = bits.length >= 2 && bits.length <= 4 && (STATE_SLUGS.has(bits.at(-1)) || STATE_SLUGS.has(bits.slice(-2).join("-")));
    const isTown = e.town || (parts.length > 1 && TOWN_FOLDER.test(parts[0])) || stateEnd;
    if (isTown) {
      towns.add(path);
      townExample ??= path;
      continue;
    }
    const shape = townShape(last, words);
    if (shape) {
      const list = prefixes.get(shape) ?? [];
      list.push(path);
      prefixes.set(shape, list);
    }
  }
  // A shape counts once a handful of pages share it: one "/garage-door-repair-cost" is an article, eight are towns.
  for (const list of prefixes.values()) {
    if (list.length < 5) continue;
    for (const p of list) towns.add(p);
    townExample ??= list[0];
  }
  const fresh = (e) => {
    const t = Date.parse(e.lastmod ?? "");
    return Number.isFinite(t) && now - t <= 90 * 86_400_000 && t <= now + 86_400_000;
  };
  return {
    total: seen.size,
    towns: { count: towns.size, example: townExample },
    blog: { posts: blog.length, fresh90: blog.filter(fresh).length },
    families: [...families].map(([family, pages]) => ({ family, pages })).sort((a, b) => b.pages - a.pages).slice(0, 6),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Profiles, booking, phones, a year ago
// ---------------------------------------------------------------------------------------------------------------------

export const SOCIAL_LABEL = {
  facebook: "Facebook", instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", nextdoor: "Nextdoor", yelp: "Yelp", linkedin: "LinkedIn",
  x: "X", pinterest: "Pinterest", bbb: "BBB", angi: "Angi", houzz: "Houzz", thumbtack: "Thumbtack",
};
const SOCIALS = [
  ["facebook", /^https?:\/\/(?:www\.|m\.|business\.)?facebook\.com\/(?!sharer|share|dialog|plugins|tr\b|events|groups\/?$|login|policies|privacy)[A-Za-z0-9.\-_%]+/i],
  ["instagram", /^https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|explore|reel\/|accounts)[A-Za-z0-9._]+/i],
  ["youtube", /^https?:\/\/(?:www\.|m\.)?youtube\.com\/(?:@|channel\/|c\/|user\/)[A-Za-z0-9._-]+/i],
  ["tiktok", /^https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._]+/i],
  ["nextdoor", /^https?:\/\/(?:www\.)?nextdoor\.com\/(?:pages?|business)\/[A-Za-z0-9\-/]+/i],
  ["yelp", /^https?:\/\/(?:www\.|m\.)?yelp\.com\/biz\/[A-Za-z0-9\-%]+/i],
  ["linkedin", /^https?:\/\/(?:www\.)?linkedin\.com\/company\/[A-Za-z0-9\-_%]+/i],
  ["x", /^https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!share|intent|home|search)[A-Za-z0-9_]{2,}/i],
  ["pinterest", /^https?:\/\/(?:www\.)?pinterest\.com\/(?!pin\/)[A-Za-z0-9_]+/i],
  ["bbb", /^https?:\/\/(?:www\.)?bbb\.org\/(?:us|ca)\/[A-Za-z0-9\-/]+/i],
  ["angi", /^https?:\/\/(?:www\.)?angi(?:es)?(?:list)?\.com\/companylist\/[A-Za-z0-9\-/.]+/i],
  ["houzz", /^https?:\/\/(?:www\.)?houzz\.com\/(?:pro|professionals|hznb\/professionals)\/[A-Za-z0-9\-/]+/i],
  ["thumbtack", /^https?:\/\/(?:www\.)?thumbtack\.com\/[a-z]{2}\/[A-Za-z0-9\-/]+/i],
];

/** The profiles a page links to, one per network (the first link wins). */
export function socialsIn(html) {
  const out = [];
  for (const m of String(html ?? "").matchAll(/href=["']([^"'#]+)["']/gi)) {
    const href = m[1].replace(/&amp;/g, "&").trim();
    for (const [network, re] of SOCIALS) {
      if (out.some((s) => s.network === network)) continue;
      const hit = href.match(re);
      if (hit) out.push({ network, url: hit[0] });
    }
  }
  return out;
}

/** A "Book online" / "Schedule service" button: online booking without a known booking tool behind it. */
export function bookingButton(html) {
  for (const m of String(html ?? "").matchAll(/<(a|button)\b[^>]*>([\s\S]{0,160}?)<\/\1>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (/\b(book|schedule)\b.{0,24}\b(online|now|service|appointment|today|a (?:visit|call|repair|tech))\b/i.test(text) && text.length < 60) return text;
  }
  return null;
}

/** The number on Google and the numbers on the site, when Google's isn't among them (often a tracking number). */
export function phoneNote(googlePhone, sitePhones) {
  const g = String(googlePhone ?? "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (g.length !== 10 || !sitePhones?.length || sitePhones.includes(g)) return null;
  return { google: prettyPhone(g), site: prettyPhone(sitePhones[0]) };
}

const fold = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** "Repair Services for You Repair Services for You" (a heading written twice for phone and desktop) -> once. */
export function undouble(s) {
  if (!s) return s;
  const w = s.split(" ");
  if (w.length >= 4 && w.length % 2 === 0 && fold(w.slice(0, w.length / 2).join(" ")) === fold(w.slice(w.length / 2).join(" "))) return w.slice(0, w.length / 2).join(" ");
  return s;
}

const OFFER_WORDS = new Set("a an the and or of on for to your you our with any all get now off".split(" "));
/**
 * The same offer in other words: "$400 OFF A NEW GARAGE DOOR!" and "Get $400 Off Garage Door Installation" share an
 * amount; "Same Day Garage Door Repair" and "Same-day garage door repair" share their words.
 */
export function sameOffer(a, b) {
  const amounts = (s) => new Set([...String(s ?? "").matchAll(/\$\s?(\d[\d,]*)|(\d{1,3})\s?%/g)].map((m) => (m[1] ? `$${m[1].replace(/,/g, "")}` : `${m[2]}%`)));
  const x = amounts(a);
  const y = amounts(b);
  if (x.size && y.size) return [...x].some((v) => y.has(v));
  const set = (s) => new Set(fold(s).split(" ").filter((w) => w && !OFFER_WORDS.has(w)));
  const p = set(a);
  const q = set(b);
  if (!p.size || !q.size) return false;
  const shared = [...p].filter((w) => q.has(w)).length;
  return shared / Math.min(p.size, q.size) >= 0.75;
}

/** The home page a year ago next to today's: its headline then, whether it changed, and offers it ran then. */
export function yearAgo(thenHtml, now, capture) {
  if (!thenHtml || !capture) return null;
  const then = siteFacts(thenHtml);
  const headline = undouble(then.headline ?? then.title);
  if (!headline) return null;
  const nowLine = undouble(now.headline ?? now.title ?? "");
  const offersThen = offersIn(pageChunks(thenHtml), 4);
  return {
    month: capture.month,
    link: capture.link,
    headline,
    changed: !!nowLine && fold(headline) !== fold(nowLine),
    offers: offersThen.filter((o) => !now.offers.some((x) => sameOffer(x, o))),
  };
}

/**
 * Everything one site check found, in one object. `html` is the home page; the rest comes from site-check.mjs.
 * read: false when the home page couldn't be opened (a bot check, a site that's down): every part is then unknown.
 */
export function siteSummary({ url, html, containers = [], robots = null, llms = null, entries = null, service, googlePhone, archive = null, now = Date.now() }) {
  if (!html) return { read: false, url: url ?? null };
  const facts = siteFacts(html);
  const pageTools = siteTools(html);
  const stack = stackOf(pageTools, containers.map((c) => c.tools));
  return {
    read: true,
    url: url ?? null,
    title: facts.title,
    headline: undouble(facts.headline),
    offers: facts.offers,
    phones: facts.phones.map(prettyPhone),
    phoneNote: phoneNote(googlePhone, facts.phones),
    stack,
    gtm: containers.map((c) => c.id),
    booking: stack.some((t) => t.group === "booking") ? "tool" : bookingButton(html) ? "button" : null,
    socials: socialsIn(html),
    // robots.txt "" = the site has none (everything may read it); null = it couldn't be read.
    ai: aiAccess(robots != null ? robotsFacts(robots) : null, llms),
    pages: entries?.length ? sitePages(entries, { service, now }) : null,
    yearAgo: archive ? yearAgo(archive.html, facts, archive) : null,
  };
}

/** The tools that turn a visit into a job, grouped the way an owner thinks of them. */
export const FOLLOW_UP = ["calls", "chat", "booking", "reviews", "financing"];
export const FOLLOW_UP_LABEL = { calls: "call tracking", chat: "chat or texting", booking: "online booking", reviews: "a review tool", financing: "financing" };

/** Which follow-up groups a site has (a booking button counts as online booking). */
export function followUpOf(site) {
  if (!site?.read) return null;
  const groups = new Set(site.stack.filter((t) => FOLLOW_UP.includes(t.group)).map((t) => t.group));
  if (site.booking) groups.add("booking");
  return FOLLOW_UP.filter((g) => groups.has(g));
}
