// Claude Code as the report's writer, on your Claude plan (no API key). ZuSpy runs your installed `claude` command
// headless: no tools (it only reads the brief and answers), in an empty folder, without your MCP servers, hooks or
// settings, and with any Anthropic API key taken out of its environment so your subscription is what's used. The brief
// goes in on stdin, the answer comes back as JSON. Idea from REM (github.com/dansugc/reverse-engineer-marketing).
import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";

/** Your `claude` command: ZUSPY_CLAUDE_BIN, else the first one on your PATH (or where its installer puts it). */
export function findClaude(env = process.env) {
  if (env.ZUSPY_CLAUDE_BIN) return existsSync(env.ZUSPY_CLAUDE_BIN) ? env.ZUSPY_CLAUDE_BIN : null;
  const win = process.platform === "win32";
  const names = win ? ["claude.exe", "claude.cmd"] : ["claude"];
  const dirs = [...String(env.PATH ?? env.Path ?? "").split(delimiter), join(homedir(), ".local", "bin"), join(homedir(), ".claude", "local")].filter(Boolean);
  for (const dir of dirs) for (const name of names) if (existsSync(join(dir, name))) return join(dir, name);
  return null;
}

/** A model name goes on the command line: it may never look like an option. */
export const safeModel = (m) => (/^[A-Za-z0-9][A-Za-z0-9._:\[\]-]{0,80}$/.test(String(m ?? "")) ? String(m) : null);

/** The arguments for one headless answer. */
export function claudeArgs({ model, effort }) {
  const args = ["-p", "--output-format", "json", "--tools", "", "--no-session-persistence", "--strict-mcp-config", "--setting-sources", "project"];
  if (safeModel(model)) args.push("--model", safeModel(model));
  if (effort && /^(low|medium|high|xhigh|max)$/.test(effort)) args.push("--effort", effort);
  return args;
}

/** What Claude Code printed, read: its answer, or why it gave none. */
export function readAnswer(stdout, stderr = "") {
  let j = null;
  const text = String(stdout ?? "").trim();
  try {
    j = JSON.parse(text.slice(text.indexOf("{")));
  } catch {
    /* not JSON: an error printed before it started */
  }
  const tail = String(stderr ?? "").trim().slice(-400);
  if (!j) return { ok: false, error: tail || text.slice(-400) || "Claude Code printed nothing.", unknownOption: /unknown option|unrecognized/i.test(`${tail} ${text}`) };
  const message = String(j.result ?? "");
  if (j.is_error || !message.trim()) {
    return { ok: false, error: message || j.subtype || "Claude Code gave no answer.", notLoggedIn: /not logged in|\/login|invalid api key|authenticat/i.test(message) };
  }
  const usage = j.usage ?? {};
  return {
    ok: true,
    text: message,
    model: Object.keys(j.modelUsage ?? {})[0] ?? null,
    input: Number(usage.input_tokens ?? 0) + Number(usage.cache_read_input_tokens ?? 0) + Number(usage.cache_creation_input_tokens ?? 0),
    output: Number(usage.output_tokens ?? 0),
  };
}

function launch(bin, args, opts) {
  // npm installs `claude.cmd` on Windows, which only runs through cmd.exe; every argument is quoted for it.
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(bin)) {
    const q = (a) => `"${String(a).replace(/"/g, '""')}"`;
    return spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `"${[bin, ...args].map(q).join(" ")}"`], { ...opts, windowsVerbatimArguments: true });
  }
  return spawn(bin, args, opts);
}

function runOnce(bin, args, prompt, timeoutMs) {
  const cwd = join(tmpdir(), "zuspy-claude");
  mkdirSync(cwd, { recursive: true });
  const env = { ...process.env };
  // Your plan, not an API key; and not "inside" the Claude Code session that may have started ZuSpy.
  for (const k of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"]) delete env[k];
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let child;
    try {
      child = launch(bin, args, { cwd, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      resolve({ ok: false, error: String(e?.message ?? e) });
      return;
    }
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err = (err + d).slice(-4000)));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, error: String(e?.message ?? e) });
    });
    child.on("close", () => {
      clearTimeout(timer);
      resolve(readAnswer(out, err));
    });
    child.stdin.on("error", () => {});
    child.stdin.end(prompt);
  });
}

/**
 * The brief in, Claude's answer out. Returns { ok, text, model, input, output } or { ok: false, error, notLoggedIn }.
 * An older Claude Code without --effort is asked again without it.
 */
export async function claudeCliWrite(prompt, { bin, model = "sonnet", effort = "low", timeoutMs = 15 * 60_000 } = {}) {
  let res = await runOnce(bin, claudeArgs({ model, effort }), prompt, timeoutMs);
  if (!res.ok && res.unknownOption && effort) res = await runOnce(bin, claudeArgs({ model }), prompt, timeoutMs);
  return res;
}
