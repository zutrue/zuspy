// Small helpers for the report pages: escaping (everything shown came from someone else's website, ad or review),
// safe links, the logo, the shared styles and the footer with the one-click version.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, VERSION, ZUOPS_URL } from "../config.mjs";

export const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** A link or media source that may be put in the page: https links and the report's own media/ files only. */
export function safeUrl(v) {
  const s = String(v ?? "").trim();
  if (/^(checks\/[A-Za-z0-9_-]+\/)?media\/[A-Za-z0-9_.-]+$/.test(s)) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** JSON for a <script type="application/json"> block. */
export const scriptJson = (data) =>
  JSON.stringify(data).replace(/[<>&\u2028\u2029]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));

let logo = null;
export function logoDataUrl() {
  if (logo === null) {
    try {
      logo = `data:image/webp;base64,${readFileSync(join(ROOT, "assets", "zuspy.webp")).toString("base64")}`;
    } catch {
      logo = "";
    }
  }
  return logo;
}

const icons = {};
/** A section's matte 3D icon (assets/icons/<name>.webp) as a data URL, so the page stays one file. */
export function iconUrl(name) {
  if (!(name in icons)) {
    try {
      icons[name] = `data:image/webp;base64,${readFileSync(join(ROOT, "assets", "icons", `${name}.webp`)).toString("base64")}`;
    } catch {
      icons[name] = "";
    }
  }
  return icons[name];
}

/** A section heading led by its icon. */
export const heading = (text, icon) => `<div class="sec-head">${icon && iconUrl(icon) ? `<img src="${iconUrl(icon)}" alt="">` : ""}<h2>${esc(text)}</h2></div>`;

/** The sticky bar: the logo and the page's sections; the script marks the one in view. */
export const topbar = (links) =>
  `<nav class="topbar"><div class="wrap"><a class="brand" href="https://github.com/zutrue/zuspy" target="_blank" rel="noopener"><img src="${logoDataUrl()}" alt="">ZuSpy</a><div class="toc">${links.map(([id, label]) => `<a href="#${esc(id)}">${esc(label)}</a>`).join("")}</div></div></nav>`;

/** Marks the section in view in the top bar. */
export const TOC_SCRIPT = `(() => {
  const links = [...document.querySelectorAll(".toc a")];
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (!e.isIntersecting) return;
    links.forEach((l) => l.classList.toggle("on", l.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-40% 0px -55% 0px" });
  links.forEach((l) => { const s = document.querySelector(l.getAttribute("href")); if (s) io.observe(s); });
})();`;

export const plural = (n, one, many = `${one}s`) => `${Number(n).toLocaleString("en-US")} ${n === 1 ? one : many}`;

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export { STYLES } from "./styles.mjs";

export function ctaBlock() {
  return `<aside class="cta" id="zuops">
  <img src="${logoDataUrl()}" alt="">
  <div>
    <h3>Want this without the setup?</h3>
    <p>ZuSpy is the free, open-source version of <b>Competitor Spy</b> in Zuops. There it's one click with no API keys, it
    checks your competitors every week and tells you what changed, and any of their ads becomes yours with Copy or Remix.</p>
  </div>
  <a class="btn" href="${esc(ZUOPS_URL)}" target="_blank" rel="noopener">Try Competitor Spy on Zuops</a>
</aside>`;
}

export function footer() {
  return `<footer class="bottom">Made with <a href="https://github.com/zutrue/zuspy" target="_blank" rel="noopener">ZuSpy</a> ${esc(VERSION)}, free and open source (MIT) · Built by <a href="${esc(ZUOPS_URL)}" target="_blank" rel="noopener">Zuops</a></footer>`;
}
