// Small building blocks shared by the report's sections: a business's picture (its logo, else its initials on a calm
// colour of its own), the Facebook and Google marks, and the icons the filters use. Everything goes through esc().
import { searchName } from "../rules/ads.mjs";
import { esc, safeUrl } from "./html-kit.mjs";

const SKIP = new Set("the a an and of at llc inc co".split(" "));

/** "A1 Garage Door Service" -> "AG"; "Applewood Plumbing Heating & Electric" -> "AP". */
export function initials(name) {
  // Names hidden: "Competitor B" is B, "Another business 3" is 3.
  const hidden = String(name ?? "").match(/^(?:Competitor ([A-Z])|Another business (\d+))$/);
  if (hidden) return hidden[1] ?? hidden[2];
  const words = searchName(String(name ?? ""))
    .replace(/[^A-Za-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w && !SKIP.has(w.toLowerCase()));
  return (words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?").slice(0, 2);
}

/** A steady hue for a name, so a business keeps its colour across the page. */
export function hueOf(name) {
  let h = 0;
  for (const ch of String(name ?? "")) h = (h * 31 + ch.charCodeAt(0)) % 3600;
  // Spread names that differ by one letter ("Competitor A", "Competitor B") far apart on the wheel.
  return (h * 137) % 360;
}

/**
 * A business's picture: its logo when the report has one, else its initials. `rank` (asked for, never taken from the
 * business) puts its Google Maps place on a small badge. Sizes: xs (20px), sm (28px), md (40px), lg (56px).
 */
export function avatar({ name, logo = null }, size = "md", { rank = null } = {}) {
  const src = safeUrl(logo);
  const badge = rank != null ? `<b class="rk">${esc(rank)}</b>` : "";
  if (src) return `<span class="av av-${size} pic" title="${esc(name)}"><img src="${esc(src)}" alt="" loading="lazy">${badge}</span>`;
  return `<span class="av av-${size}" style="--h:${hueOf(name)}" title="${esc(name)}">${esc(initials(name))}${badge}</span>`;
}

/** The platform an ad runs on, as a small mark. */
export function platformMark(channel) {
  if (channel === "google")
    return `<svg class="pm" viewBox="0 0 24 24" aria-label="Google"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.2a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.2 6.6l4.1 3.1c.9-2.8 3.6-4.9 6.7-4.9z"/></svg>`;
  return `<svg class="pm" viewBox="0 0 24 24" aria-label="Facebook and Instagram"><circle cx="12" cy="12" r="12" fill="#1877F2"/><path fill="#fff" d="M13.4 24v-8.6h2.9l.4-3.4h-3.3V9.9c0-1 .3-1.6 1.7-1.6h1.8v-3a24 24 0 0 0-2.6-.1c-2.6 0-4.3 1.6-4.3 4.4V12H7.1v3.4H10V24z"/></svg>`;
}

export const ICON = {
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  prev: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  play: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`,
  ext: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

export const UI_STYLES = `
.av{--h:220;position:relative;display:inline-grid;place-items:center;flex:none;border-radius:12px;background:hsl(var(--h) 75% 94%);color:hsl(var(--h) 45% 32%);font-weight:800;letter-spacing:-.02em;line-height:1;box-shadow:inset 0 0 0 1px hsl(var(--h) 40% 86%)}
.av.pic{background:#fff;box-shadow:inset 0 0 0 1px var(--line)}
.av img{width:100%;height:100%;object-fit:contain;border-radius:inherit;padding:2px;background:#fff}
.av-xs{width:20px;height:20px;font-size:9px;border-radius:6px}.av-sm{width:28px;height:28px;font-size:11px;border-radius:8px}
.av-md{width:40px;height:40px;font-size:14px}.av-lg{width:56px;height:56px;font-size:19px;border-radius:16px}
.av .rk{position:absolute;right:-6px;bottom:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:var(--ink);color:#fff;font-size:11px;font-weight:800;display:grid;place-items:center;box-shadow:0 0 0 2px #fff}
.av-lg .rk{min-width:24px;height:24px;font-size:12px}
.pm{width:16px;height:16px;flex:none;display:inline-block;vertical-align:-3px}
`;
