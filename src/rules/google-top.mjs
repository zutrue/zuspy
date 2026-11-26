// The very top of Google on a phone: Local Services Ads ("Sponsored", Google-screened businesses, paid per lead) and
// any text ads, read from one live Google search in the town. Google rotates these and often shows none to a given
// search, so "not shown" means "not seen this time", never "doesn't pay for it". Pure rules; the search is in spy.mjs.
import { stateName } from "./site.mjs";

const fold = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|inc|co|corp|company|ltd|the|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Words any business in a trade may have in its name: two names sharing only these aren't one business.
const TRADE = new Set(
  "garage door doors gate gates repair repairs service services company pros pro plumbing plumber plumbers heating cooling air hvac ac roof roofing roofers roofer electric electrical electrician pest control lawn landscaping cleaning home homes solutions experts expert local family best 24 7 hour and".split(" "),
);

/**
 * True when two business names are the same business: "Goody Garage Doors" and "Goody Garage Doors LLC", or "A1 Garage
 * Door Service" and "A1 Garage Door Service of Phoenix". A name made only of trade words matches only itself.
 */
export function sameBusiness(a, b) {
  const x = fold(a);
  const y = fold(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  const words = short.split(" ");
  return words.length >= 2 && words.some((w) => !TRADE.has(w)) && long.startsWith(`${short} `);
}

/** Where to search from: the town as Google names it ("Phoenix,Arizona,United States"), else the competitors' middle. */
export function searchPlace(location, rivals = []) {
  const m = String(location ?? "").match(/^\s*([A-Za-z .'-]+?)\s*,\s*([A-Za-z .]+?)\s*$/);
  if (m) {
    const state = stateName(m[2].trim()) ?? (/^[a-z .]{4,}$/i.test(m[2].trim()) ? m[2].trim() : null);
    if (state) return { location_name: `${m[1].trim()},${state.replace(/\b\w/g, (c) => c.toUpperCase())},United States` };
  }
  return pointOf(rivals);
}

/** The competitors' middle point, for a town Google doesn't know by name. */
export function pointOf(rivals = []) {
  const pts = rivals.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  if (!pts.length) return null;
  const lat = pts.reduce((s, r) => s + r.lat, 0) / pts.length;
  const lng = pts.reduce((s, r) => s + r.lng, 0) / pts.length;
  return { location_coordinate: `${lat.toFixed(4)},${lng.toFixed(4)},20000` };
}

/** "17+ years in business\nOpen 24 hours · Serves Phoenix\n24/7 emergency services · Free estimate" -> its parts. */
function lsaDetails(description) {
  const bits = String(description ?? "")
    .split(/\n|·|⁦|⁩/)
    .map((s) => s.replace(/[⁦-⁩]/g, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  let years = null;
  const badges = [];
  for (const b of bits) {
    const y = b.match(/^(\d+)\+?\s+years?\s+in\s+business$/i);
    if (y) years = Number(y[1]);
    else if (/^open\b|^closed\b|^opens\b|^closes\b|^serves\b/i.test(b)) continue;
    else if (b.length <= 40 && !badges.includes(b)) badges.push(b);
  }
  return { years, badges: badges.slice(0, 4) };
}

/** What one search showed at the top: Local Services Ads and text ads. */
export function topOfGoogle(items) {
  const list = Array.isArray(items) ? items : [];
  const block = list.find((it) => it?.type === "local_services");
  const businesses = (block?.items ?? [])
    .filter((e) => e && typeof e.title === "string")
    .map((e, i) => ({
      name: e.title.replace(/\s+/g, " ").trim().slice(0, 120),
      position: i + 1,
      rating: Number.isFinite(Number(e.rating?.value)) ? Number(e.rating.value) : null,
      reviews: Number.isFinite(Number(e.rating?.votes_count)) ? Number(e.rating.votes_count) : null,
      ...lsaDetails(e.description),
    }))
    .slice(0, 12);
  const paid = list
    .filter((it) => it?.type === "paid" && (it.title || it.description))
    .map((it) => ({ title: String(it.title ?? "").slice(0, 160), domain: String(it.domain ?? "").slice(0, 120) || null, text: String(it.description ?? "").replace(/\s+/g, " ").slice(0, 300) }))
    .slice(0, 6);
  return { shown: businesses.length > 0, businesses, paid };
}

/** Each Local Services business matched to a competitor (by name) where it is one. */
export function matchTop(top, rivals) {
  if (!top) return top;
  return {
    ...top,
    businesses: top.businesses.map((b) => ({ ...b, rival: rivals.find((r) => sameBusiness(r.name, b.name))?.id ?? null })),
  };
}
