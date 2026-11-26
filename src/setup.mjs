// `zuspy setup`: a page on your own computer where you paste your API keys, test each one, and save them.
//
// The keys go from your browser straight to this process and into a private file in your user folder
// (~/.zuspy/.env, readable only by you), never into a chat, a project folder or a repo. The page only answers on
// 127.0.0.1, only with the one-time code in its link, and only for its own address (so no other website can reach it),
// and the server closes itself once you save, or after 20 minutes.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname } from "node:path";
import { anthropicSdk } from "./providers/ai.mjs";
import { keysFile, readKeysFile, ZUOPS_URL } from "./config.mjs";
import { findBrowser } from "./providers/meta-library.mjs";
import { esc, iconUrl, logoDataUrl } from "./report/html-kit.mjs";
import { STYLES } from "./report/styles.mjs";

/** Every key the page can set, in the order they're written to the file. */
export const KEYS = [
  "DATAFORSEO_LOGIN",
  "DATAFORSEO_PASSWORD",
  "ZUSPY_AI",
  "ANTHROPIC_API_KEY",
  "OPENROUTER_API_KEY",
  "ZURELAY_API_KEY",
  "ZUSPY_AI_BASE_URL",
  "ZUSPY_AI_KEY",
  "ZUSPY_MODEL",
  "FIRECRAWL_API_KEY",
];
const SECRET = new Set(["DATAFORSEO_PASSWORD", "ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "ZURELAY_API_KEY", "ZUSPY_AI_KEY", "FIRECRAWL_API_KEY"]);

const quote = (v) => (/^[A-Za-z0-9_@.:/+=-]*$/.test(v) ? v : v.includes("'") ? `"${v.replace(/"/g, "")}"` : `'${v}'`);

/** Writes the keys file: what was there, with the page's changes (an empty box keeps the saved value; "-" clears it). */
export function writeKeys(changes) {
  const now = readKeysFile();
  for (const k of KEYS) {
    const v = typeof changes[k] === "string" ? changes[k].trim() : "";
    if (v === "-") delete now[k];
    else if (v) now[k] = v.replace(/[\r\n]/g, "");
  }
  const lines = ["# ZuSpy keys, written by `zuspy setup`. Keep this file private.", ...KEYS.filter((k) => now[k]).map((k) => `${k}=${quote(now[k])}`), ""];
  mkdirSync(dirname(keysFile()), { recursive: true });
  writeFileSync(keysFile(), lines.join("\n"), { mode: 0o600 });
  try {
    chmodSync(keysFile(), 0o600);
  } catch {
    /* Windows: the file is in your own user folder */
  }
  return now;
}

const last4 = (v) => (v ? `…${String(v).slice(-4)}` : "");

/** Checks one service with the keys typed (or saved). Small requests only: a balance read or a two-word answer. */
export async function testKeys(kind, typed) {
  const saved = readKeysFile();
  const get = (k) => (typeof typed[k] === "string" && typed[k].trim() && typed[k].trim() !== "-" ? typed[k].trim() : saved[k] ?? "");
  try {
    if (kind === "dataforseo") {
      const login = get("DATAFORSEO_LOGIN");
      const password = get("DATAFORSEO_PASSWORD");
      if (!login || !password) return { ok: false, message: "Fill in both the API login and the API password." };
      const r = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
        headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}` },
        signal: AbortSignal.timeout(20_000),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.status_code === 20000) {
        const balance = Number(j.tasks?.[0]?.result?.[0]?.money?.balance ?? 0);
        return { ok: true, message: `Connected. Balance $${balance.toFixed(2)}${balance < 1 ? ": add a little before your first report (one uses about 4 cents)." : ` (enough for about ${Math.floor(balance / 0.05)} reports).`}` };
      }
      return { ok: false, message: `DataForSEO said: ${j?.status_message ?? `error ${r.status}`}. Use the API login and API password from app.dataforseo.com/api-access, not your website password.` };
    }
    if (kind === "anthropic") {
      const key = get("ANTHROPIC_API_KEY");
      if (!key) return { ok: false, message: "Paste your Anthropic API key." };
      const Anthropic = await anthropicSdk();
      const client = new Anthropic({ apiKey: key, maxRetries: 1, timeout: 60_000 });
      const res = await client.messages.create({ model: "claude-haiku-5-5", max_tokens: 64, output_config: { effort: "low" }, messages: [{ role: "user", content: "Reply with the word OK." }] });
      return { ok: true, message: `Connected (${res.model}). A report costs about $0.10 of Claude Sonnet 5.5.` };
    }
    if (kind === "openai") {
      const pick = get("ZUSPY_AI");
      const preset = { openrouter: ["https://openrouter.ai/api/v1", get("OPENROUTER_API_KEY"), "anthropic/claude-haiku-5.5"], zurelay: ["https://api.zurelay.com/v1", get("ZURELAY_API_KEY"), "claude-haiku-5-5"] }[pick];
      const [base, key, model] = preset ?? [get("ZUSPY_AI_BASE_URL").replace(/\/+$/, ""), get("ZUSPY_AI_KEY"), get("ZUSPY_MODEL")];
      if (!base || !key || !model) return { ok: false, message: "Fill in the key (and for another service, its address and model)." };
      const r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: 64, messages: [{ role: "user", content: "Reply with the word OK." }] }),
        signal: AbortSignal.timeout(60_000),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.choices?.[0]) return { ok: true, message: `Connected (${j.model ?? model}).` };
      return { ok: false, message: `It answered ${r.status}: ${String(j?.error?.message ?? "no answer").slice(0, 200)}` };
    }
    if (kind === "firecrawl") {
      const key = get("FIRECRAWL_API_KEY");
      if (!key) return { ok: false, message: "Paste your Firecrawl key, or leave it empty: your browser reads the Ad Library for free." };
      const r = await fetch("https://api.firecrawl.dev/v1/team/credit-usage", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20_000) });
      const j = await r.json().catch(() => null);
      if (r.status === 401 || r.status === 403) return { ok: false, message: "Firecrawl turned that key down." };
      const left = j?.data?.remaining_credits;
      return { ok: true, message: Number.isFinite(Number(left)) ? `Connected. ${Number(left).toLocaleString("en-US")} credits left.` : "Saved key looks right." };
    }
    return { ok: false, message: "Unknown check." };
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (/401|authentication|invalid x-api-key/i.test(msg)) return { ok: false, message: "That key was turned down." };
    return { ok: false, message: `Couldn't check it: ${msg.slice(0, 200)}` };
  }
}

function page(token) {
  const saved = readKeysFile();
  const browser = findBrowser();
  const have = (k) => (saved[k] ? `<span class="saved">saved ${esc(SECRET.has(k) ? last4(saved[k]) : saved[k])}</span>` : "");
  const box = (k, label, { type = "text", placeholder = "" } = {}) =>
    `<label class="f"><span>${esc(label)} ${have(k)}</span><input name="${k}" type="${type}" autocomplete="off" spellcheck="false" placeholder="${esc(saved[k] ? "leave empty to keep the saved one" : placeholder)}"></label>`;
  const ai = saved.ZUSPY_AI ?? (saved.ANTHROPIC_API_KEY ? "anthropic" : saved.OPENROUTER_API_KEY ? "openrouter" : saved.ZURELAY_API_KEY ? "zurelay" : saved.ZUSPY_AI_BASE_URL ? "openai" : "claude-code");
  const radio = (v, title, text) => `<label class="opt"><input type="radio" name="ZUSPY_AI" value="${v}"${ai === v ? " checked" : ""}><span><b>${esc(title)}</b><small>${text}</small></span></label>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Set up ZuSpy</title><link rel="icon" href="${logoDataUrl()}">
<style>${STYLES}
.setup{max-width:860px;margin:0 auto;padding:36px 24px 60px}
.setup h1{font-size:clamp(30px,4vw,44px);margin:14px 0 8px}
.step{display:grid;grid-template-columns:56px 1fr;gap:18px;padding:26px;margin-top:18px}
.step > img{width:56px;height:56px}
.step h2{font-size:21px;margin:0 0 4px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.req{font-size:12px;font-weight:700;border-radius:999px;padding:3px 9px;background:var(--blue-soft);color:var(--blue-ink)}
.req.opt2{background:#F2F4F7;color:var(--muted)}
.how2{margin:6px 0 14px;padding-left:20px;color:var(--ink-2)}.how2 li{margin:4px 0}
.f{display:grid;gap:6px;margin:10px 0}.f span{font-size:13.5px;font-weight:700;color:var(--ink-2)}
.f input{font:inherit;font-size:15px;padding:11px 13px;border:1.5px solid var(--line);border-radius:12px;background:#fff;outline:none}
.f input:focus{border-color:var(--blue);box-shadow:0 0 0 4px var(--blue-soft)}
.saved{font-weight:600;color:var(--green);margin-left:6px}
.row2{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}
.test{border:1.5px solid var(--line);background:#fff;border-radius:11px;padding:9px 14px;font:inherit;font-weight:700;font-size:14px;cursor:pointer}
.test:hover{border-color:var(--blue);color:var(--blue-ink)}
.res{font-size:14px;font-weight:600}.res.ok{color:var(--green)}.res.bad{color:var(--red)}
.opts{display:grid;gap:10px;margin:12px 0}
.opt{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start;border:1.5px solid var(--line);border-radius:14px;padding:13px 14px;cursor:pointer}
.opt:has(input:checked){border-color:var(--blue);background:var(--blue-soft)}
.opt input{margin-top:3px;accent-color:var(--blue)}.opt small{display:block;color:var(--muted);font-size:13.5px;margin-top:2px}
.pane{display:none}.pane.on{display:block}
.note{background:#F7F9FC;border:1px solid var(--line);border-radius:12px;padding:11px 13px;font-size:14px;color:var(--ink-2)}
.savebar{position:sticky;bottom:0;margin-top:22px;background:rgba(255,255,255,.95);backdrop-filter:blur(8px);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow-lg);padding:16px 18px;display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.savebar .btn{border:0;font:inherit;font-weight:700;font-size:15px;cursor:pointer}
.done{text-align:center;padding:60px 26px}.done img{width:110px;height:110px}
</style></head><body>
<div class="setup" id="app">
  <div class="brand"><img src="${logoDataUrl()}" alt="">ZuSpy</div>
  <h1>Set up ZuSpy</h1>
  <p class="lead" style="font-size:16.5px">Paste your keys here, test them, and save. They're kept in a private file on this computer (<code>${esc(keysFile().replace(homedir(), "~"))}</code>), never in a chat or a project folder. This page only works on this computer and closes when you save.</p>

  <form id="f" autocomplete="off">
  <div class="card step"><img src="${iconUrl("rivals")}" alt=""><div>
    <h2>Google Maps, reviews and Google ads <span class="req">Required</span></h2>
    <p class="why" style="margin:0">From DataForSEO, pay as you go. A report uses about 4 cents of it.</p>
    <ol class="how2">
      <li>Make a free account at <a href="https://app.dataforseo.com/register" target="_blank" rel="noopener">app.dataforseo.com/register</a> and add a little balance.</li>
      <li>Open <a href="https://app.dataforseo.com/api-access" target="_blank" rel="noopener">API Access</a>: copy the <b>API login</b> (your email) and the <b>API password</b> (not your website password).</li>
    </ol>
    ${box("DATAFORSEO_LOGIN", "API login", { placeholder: "you@yourbusiness.com" })}
    ${box("DATAFORSEO_PASSWORD", "API password", { type: "password", placeholder: "the API password from API Access" })}
    <div class="row2"><button type="button" class="test" data-test="dataforseo">Test it</button><span class="res" data-res="dataforseo"></span></div>
  </div></div>

  <div class="card step"><img src="${iconUrl("win")}" alt=""><div>
    <h2>The AI that writes your report <span class="req">Pick one</span></h2>
    <div class="opts">
      ${radio("claude-code", "Claude Code, no key", "Your Claude subscription writes the analysis when you run ZuSpy from Claude Code. Nothing to pay here.")}
      ${radio("anthropic", "Anthropic API key", "Claude Sonnet 5.5, about $0.10 a report.")}
      ${radio("openrouter", "OpenRouter key", "One key for many models, Claude Sonnet 5.5 by default.")}
      ${radio("zurelay", "Zurelay key", "Our own AI gateway, Claude Sonnet 5.5 by default.")}
      ${radio("openai", "Another OpenAI-compatible API", "OpenAI, a local model or any service with a /chat/completions address.")}
    </div>
    <div class="pane" data-pane="claude-code"><div class="note">Nothing more to set. Run ZuSpy from Claude Code and it writes the analysis itself.</div></div>
    <div class="pane" data-pane="anthropic">${box("ANTHROPIC_API_KEY", "Anthropic API key", { type: "password", placeholder: "sk-ant-..." })}<p class="why">Make one at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>.</p></div>
    <div class="pane" data-pane="openrouter">${box("OPENROUTER_API_KEY", "OpenRouter key", { type: "password", placeholder: "sk-or-..." })}<p class="why">Make one at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a>.</p></div>
    <div class="pane" data-pane="zurelay">${box("ZURELAY_API_KEY", "Zurelay key", { type: "password", placeholder: "zr_live_..." })}<p class="why">Make one at <a href="https://zurelay.com" target="_blank" rel="noopener">zurelay.com</a>.</p></div>
    <div class="pane" data-pane="openai">${box("ZUSPY_AI_BASE_URL", "Address", { placeholder: "https://api.openai.com/v1" })}${box("ZUSPY_AI_KEY", "Key", { type: "password" })}${box("ZUSPY_MODEL", "Model", { placeholder: "the model's name at that service" })}</div>
    <div class="row2" data-ai-test><button type="button" class="test" data-test="ai">Test it</button><span class="res" data-res="ai"></span></div>
  </div></div>

  <div class="card step"><img src="${iconUrl("ads")}" alt=""><div>
    <h2>Facebook and Instagram ads <span class="req opt2">${browser ? "Ready" : "Needs a browser or a key"}</span></h2>
    <p class="why" style="margin:0 0 10px">Meta's Ad Library has no API for business ads, so ZuSpy reads it in a hidden browser with an empty profile (nothing of yours is used).</p>
    <div class="note">${browser ? `Found your browser: <b>${esc(browser)}</b>. Facebook and Instagram ads are free.` : "No Chrome, Edge, Chromium or Brave was found. Install one, or add a Firecrawl key below."}</div>
    ${box("FIRECRAWL_API_KEY", `Firecrawl key (${browser ? "optional backup" : "needed without a browser"})`, { type: "password", placeholder: "fc-..." })}
    <div class="row2"><button type="button" class="test" data-test="firecrawl">Test it</button><span class="res" data-res="firecrawl"></span></div>
  </div></div>

  <div class="savebar"><span class="why">Empty boxes keep what's saved. Type <b>-</b> in a box to remove that key.</span><button type="submit" class="btn">Save and finish</button></div>
  </form>
  <p class="why" style="text-align:center;margin-top:26px">Rather skip all this? <a href="${esc(ZUOPS_URL)}" target="_blank" rel="noopener">Competitor Spy in Zuops</a> needs no keys.</p>
</div>
<script>
(() => {
  const T = ${JSON.stringify(token)};
  const form = document.getElementById("f");
  const values = () => Object.fromEntries([...form.querySelectorAll("input")].filter((i) => i.type !== "radio" || i.checked).map((i) => [i.name, i.value]));
  const ai = () => (form.querySelector('input[name="ZUSPY_AI"]:checked') || {}).value || "claude-code";
  const panes = () => {
    form.querySelectorAll(".pane").forEach((p) => p.classList.toggle("on", p.dataset.pane === ai()));
    form.querySelector("[data-ai-test]").style.display = ai() === "claude-code" ? "none" : "";
  };
  form.querySelectorAll('input[name="ZUSPY_AI"]').forEach((r) => r.addEventListener("change", panes));
  panes();
  const call = (path, body) => fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "X-ZuSpy-Token": T }, body: JSON.stringify(body) }).then((r) => r.json());
  form.querySelectorAll("[data-test]").forEach((b) => b.addEventListener("click", async () => {
    const kind = b.dataset.test === "ai" ? (ai() === "anthropic" ? "anthropic" : "openai") : b.dataset.test;
    const out = form.querySelector('[data-res="' + b.dataset.test + '"]');
    out.className = "res"; out.textContent = "Checking…";
    const r = await call("/api/test", { kind, values: values() }).catch(() => ({ ok: false, message: "The setup page stopped. Run zuspy setup again." }));
    out.className = "res " + (r.ok ? "ok" : "bad"); out.textContent = (r.ok ? "✓ " : "✕ ") + r.message;
  }));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const r = await call("/api/save", { values: values() }).catch(() => null);
    if (!r || !r.ok) return alert((r && r.message) || "Couldn't save. Run zuspy setup again.");
    document.getElementById("app").innerHTML = '<div class="card done"><img src="${logoDataUrl()}" alt=""><h1>You\\'re set up</h1><p class="lead" style="margin:0 auto;max-width:520px">' + r.message + '</p><p class="why">You can close this tab and go back to Claude Code or your terminal.</p></div>';
  });
})();
</script>
</body></html>`;
}

/**
 * Starts the page and resolves once the keys are saved (or after 20 minutes). `open(url)` opens it in the browser.
 */
export function runSetup({ open, log = console.log, port = 0 } = {}) {
  const token = randomBytes(18).toString("base64url");
  return new Promise((resolve, reject) => {
    let address = "";
    const server = createServer(async (req, res) => {
      const send = (status, type, body) => {
        res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" });
        res.end(body);
      };
      // Only this page's own address (blocks other websites that point a name at 127.0.0.1).
      if (req.headers.host !== address && req.headers.host !== address.replace("127.0.0.1", "localhost")) return send(403, "text/plain", "Not here.");
      const url = new URL(req.url, `http://${address}`);
      if (req.method === "GET" && url.pathname === "/") {
        if (url.searchParams.get("t") !== token) return send(403, "text/plain", "This link has expired. Run zuspy setup again.");
        return send(200, "text/html; charset=utf-8", page(token));
      }
      if (req.method !== "POST" || req.headers["x-zuspy-token"] !== token || !String(req.headers["content-type"]).startsWith("application/json")) return send(403, "text/plain", "Not here.");
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 20_000) return send(413, "text/plain", "Too long.");
      }
      let data = {};
      try {
        data = JSON.parse(body);
      } catch {
        return send(400, "application/json", JSON.stringify({ ok: false, message: "Bad request." }));
      }
      const values = data.values && typeof data.values === "object" ? data.values : {};
      if (url.pathname === "/api/test") return send(200, "application/json", JSON.stringify(await testKeys(String(data.kind), values)));
      if (url.pathname === "/api/save") {
        const saved = writeKeys(values);
        const ai = saved.ZUSPY_AI ?? "claude-code";
        const missing = !saved.DATAFORSEO_LOGIN || !saved.DATAFORSEO_PASSWORD;
        const message = missing
          ? "Saved. DataForSEO is still missing, and ZuSpy needs it for reports: run zuspy setup again once you have it."
          : `Saved. ZuSpy will use DataForSEO, and ${{ "claude-code": "Claude Code", anthropic: "Claude through the Anthropic API", openrouter: "OpenRouter", zurelay: "Zurelay" }[ai] ?? "your AI service"} for the analysis.`;
        send(200, "application/json", JSON.stringify({ ok: true, message }));
        log(`Keys saved to ${keysFile()}.`);
        setTimeout(() => {
          server.close(() => resolve({ saved: true }));
          server.closeAllConnections?.();
        }, 400);
        return;
      }
      return send(404, "text/plain", "Not here.");
    });
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      address = `127.0.0.1:${server.address().port}`;
      const link = `http://${address}/?t=${token}`;
      log("Opening the ZuSpy setup page in your browser. Paste your keys there, test them and click Save.");
      log(`If it didn't open, go to: ${link}`);
      log("(Waiting for you to save. The page closes after 20 minutes.)");
      open?.(link);
    });
    setTimeout(() => server.close(() => resolve({ saved: false })), 20 * 60_000).unref();
  });
}
