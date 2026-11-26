// Settings: API keys from the environment or a .env file (the folder you run ZuSpy in first, then ZuSpy's own
// folder), and where reports go. Keys are only ever read here and sent to their own service.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const VERSION = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version;

/** The one-click version, for anyone who'd rather not hold API keys. */
export const ZUOPS_URL = "https://zuops.com/features/competitor-spy?utm_source=zuspy&utm_medium=github";

export function parseDotEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^".*"$/.test(v) || /^'.*'$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    out[m[1]] = v;
  }
  return out;
}

/** Where `zuspy setup` keeps your keys: a private file in your user folder, outside every project and repo. */
export const keysFile = () => join(process.env.ZUSPY_HOME || join(homedir(), ".zuspy"), ".env");

export function readKeysFile() {
  return existsSync(keysFile()) ? parseDotEnv(readFileSync(keysFile(), "utf8")) : {};
}

let loaded = false;
/** Fills process.env from .env files without overwriting what is already set: this folder's, then your keys file. */
export function loadEnv(again = false) {
  if (loaded && !again) return;
  loaded = true;
  for (const file of [join(process.cwd(), ".env"), keysFile(), join(ROOT, ".env")]) {
    if (!existsSync(file)) continue;
    for (const [k, v] of Object.entries(parseDotEnv(readFileSync(file, "utf8")))) {
      if (process.env[k] === undefined || process.env[k] === "") process.env[k] = v;
    }
  }
}

const env = (name) => {
  loadEnv();
  const v = process.env[name];
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

/** Where reports and watched companies are kept. */
export function reportsDir() {
  return resolve(env("ZUSPY_DIR") ?? join(process.cwd(), "zuspy-reports"));
}

/** DataForSEO's login (Google Maps, Google reviews, Google's Ads Transparency Center). */
export function dataForSeoAuth() {
  const login = env("DATAFORSEO_LOGIN");
  const password = env("DATAFORSEO_PASSWORD");
  return login && password ? `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}` : null;
}

export const firecrawlKey = () => env("FIRECRAWL_API_KEY");

/** How Meta's Ad Library is read: "auto" (your browser, then Firecrawl), "browser", "firecrawl" or "off". */
export const metaMode = () => (env("ZUSPY_META") ?? "auto").toLowerCase();

export const browserPath = () => env("ZUSPY_BROWSER");

/**
 * Which AI writes the report.
 *  - anthropic: ANTHROPIC_API_KEY (Claude through the official SDK; ANTHROPIC_BASE_URL is respected)
 *  - openai:    any OpenAI-compatible API: ZUSPY_AI_BASE_URL + ZUSPY_AI_KEY (OpenRouter, Zurelay, OpenAI, a local model ...)
 *  - claude-code: no key; ZuSpy writes the prompt and Claude Code (your subscription) writes the analysis
 */
export function aiConfig(forced) {
  const pick = (forced ?? env("ZUSPY_AI") ?? "").toLowerCase();
  const effort = env("ZUSPY_EFFORT") ?? "low";
  const anthropic = () => ({
    engine: "anthropic",
    key: env("ANTHROPIC_API_KEY"),
    baseURL: env("ANTHROPIC_BASE_URL"),
    model: env("ZUSPY_MODEL") ?? "claude-sonnet-5-5",
    readerModel: env("ZUSPY_READER_MODEL") ?? "claude-haiku-5-5",
    effort,
  });
  const openai = (only) => {
    const presets = [
      ["openrouter", "OPENROUTER_API_KEY", "https://openrouter.ai/api/v1", "anthropic/claude-sonnet-5.5", "anthropic/claude-haiku-5.5"],
      ["zurelay", "ZURELAY_API_KEY", "https://api.zurelay.com/v1", "claude-sonnet-5-5", "claude-haiku-5-5"],
    ].filter(([id]) => !only || id === only);
    const own = only ? null : env("ZUSPY_AI_BASE_URL");
    if (own) {
      return {
        engine: "openai",
        key: env("ZUSPY_AI_KEY") ?? env("OPENAI_API_KEY"),
        baseURL: own.replace(/\/+$/, ""),
        model: env("ZUSPY_MODEL") ?? "claude-sonnet-5-5",
        readerModel: env("ZUSPY_READER_MODEL") ?? env("ZUSPY_MODEL") ?? "claude-haiku-5-5",
        effort,
      };
    }
    for (const [, name, baseURL, model, readerModel] of presets) {
      if (env(name)) return { engine: "openai", key: env(name), baseURL, model: env("ZUSPY_MODEL") ?? model, readerModel: env("ZUSPY_READER_MODEL") ?? readerModel, effort };
    }
    return { engine: "openai", key: null, baseURL: only ? presets[0]?.[2] ?? null : null, model: env("ZUSPY_MODEL"), readerModel: null, effort };
  };
  if (pick === "anthropic") return anthropic();
  if (pick === "openrouter" || pick === "zurelay") return openai(pick);
  if (pick === "openai") return openai();
  if (pick === "claude-code" || pick === "claude") return { engine: "claude-code" };
  if (env("ANTHROPIC_API_KEY")) return anthropic();
  const o = openai();
  if (o.key && o.baseURL) return o;
  return { engine: "claude-code" };
}

/** True inside a Claude Code session (it sets CLAUDECODE=1 for the commands it runs). */
export const inClaudeCode = () => env("CLAUDECODE") === "1";
