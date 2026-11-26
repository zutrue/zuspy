#!/usr/bin/env node
// ZuSpy: spy on your local competitors. Run `zuspy help`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { aiConfig, dataForSeoAuth, firecrawlKey, inClaudeCode, keysFile, loadEnv, reportsDir, VERSION, ZUOPS_URL } from "../src/config.mjs";
import { metaReader } from "../src/providers/meta-library.mjs";
import { finish, spy } from "../src/spy.mjs";
import { renderReport } from "../src/report/render.mjs";
import { watchCheck, watchList, watchRemove } from "../src/watch.mjs";
import { runSetup } from "../src/setup.mjs";

loadEnv();

const HELP = `ZuSpy ${VERSION}: spy on your local competitors.

  zuspy setup
      Opens a page in your browser to paste and test your API keys. They're saved in a private file in your
      user folder (${keysFile()}), never in a chat or a project.

  zuspy spy "<what you sell>" "<town, ST>" [--me "<your business>"] [--rivals 5] [--no-reviews] [--ai anthropic|openai|claude-code] [--open]
      Who beats you on Google Maps, every ad they're running on Facebook, Instagram and Google, what their
      customers complain about, and the ads and offers that win those customers. About 3-5 minutes.

  zuspy watch <their website> [--name "<their business name>"] [--town "<town, ST>"] [--open]
      Check one company now, and again later: their ads, offers, website, pages, jobs and Google listing.
      The first check also reads their last year from the web archive. Every later check lists what changed.
  zuspy watch                 the companies you watch, and when each was last checked
  zuspy watch --all           check every company you watch (run it weekly from cron or Task Scheduler)
  zuspy watch --remove <host> stop watching one

  zuspy finish <report folder>   turn Claude Code's analysis.json into the report (when no AI key is set)
  zuspy rebuild <report folder> [--anonymous]   draw report.html again; --anonymous hides every business name
  zuspy list                     your reports
  zuspy open <report folder>     open a report in your browser
  zuspy doctor                   check your keys and what will run

Keys: zuspy setup (or a .env file, see .env.example). Reports are saved in ./zuspy-reports (ZUSPY_DIR to change).
Rather not hold API keys? Competitor Spy is built into Zuops: ${ZUOPS_URL}
`;

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=", 2);
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

function openFile(file) {
  const cmd = process.platform === "win32" ? ["cmd", ["/c", "start", "", file]] : process.platform === "darwin" ? ["open", [file]] : ["xdg-open", [file]];
  try {
    spawn(cmd[0], cmd[1], { stdio: "ignore", detached: true, windowsHide: true }).unref();
  } catch {
    /* the path is printed anyway */
  }
}

function reportFolder(arg) {
  if (!arg) throw new Error("Which report? Give its folder (zuspy list shows them).");
  for (const p of [resolve(arg), join(reportsDir(), arg)]) if (existsSync(join(p, "state.json")) || existsSync(join(p, "report.json"))) return p;
  throw new Error(`No ZuSpy report in ${arg}.`);
}

async function doctor() {
  const ok = (b) => (b ? "OK " : "-- ");
  const major = Number(process.versions.node.split(".")[0]);
  console.log(`ZuSpy ${VERSION} on Node ${process.versions.node}\n`);
  console.log(`${ok(major >= 18)} Node 18 or newer`);
  const dfs = dataForSeoAuth();
  console.log(`${ok(!!dfs)} DataForSEO (Google Maps, reviews, Google ads): ${dfs ? "login found" : "missing DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD (required for `spy`)"}`);
  if (dfs) {
    try {
      const r = await fetch("https://api.dataforseo.com/v3/appendix/user_data", { headers: { Authorization: dfs }, signal: AbortSignal.timeout(15_000) });
      const j = await r.json().catch(() => null);
      const money = j?.tasks?.[0]?.result?.[0]?.money;
      if (r.ok && j?.status_code === 20000) console.log(`    balance: $${Number(money?.balance ?? 0).toFixed(2)}`);
      else console.log(`    DataForSEO said: ${j?.status_message ?? r.status} (check the login)`);
    } catch {
      console.log("    couldn't reach DataForSEO to check the balance");
    }
  }
  const meta = metaReader();
  console.log(`${ok(meta.how !== "none" && meta.how !== "off")} Facebook & Instagram ads: ${meta.detail}`);
  const ai = aiConfig();
  if (ai.engine === "claude-code") console.log(`OK  AI: no API key set, so Claude Code writes the analysis${inClaudeCode() ? " (you're in Claude Code)" : " (run ZuSpy from Claude Code, or set ANTHROPIC_API_KEY)"}`);
  else console.log(`${ok(!!ai.key && !!ai.model)} AI: ${ai.engine === "anthropic" ? "Anthropic API" : ai.baseURL} · ${ai.model} (reads ad pictures with ${ai.readerModel}) · effort ${ai.effort}`);
  if (!firecrawlKey() && meta.how === "browser") console.log("    (optional) FIRECRAWL_API_KEY as a backup reader for the Ad Library");
  console.log(`\nReports go to ${reportsDir()}`);
  console.log(`Keys file: ${keysFile()}`);
  if (!dfs) console.log("\nNext: run `zuspy setup` to add your DataForSEO login (and an AI key if you want one).");
}

function list() {
  const dir = reportsDir();
  if (!existsSync(dir)) return console.log("No reports yet. Run: zuspy spy \"garage door repair\" \"Phoenix, AZ\"");
  const rows = readdirSync(dir)
    .filter((d) => d !== "watch" && existsSync(join(dir, d, "state.json")))
    .map((d) => ({ d, done: existsSync(join(dir, d, "report.json")), at: statSync(join(dir, d)).mtimeMs }))
    .sort((a, b) => b.at - a.at);
  if (!rows.length) console.log("No reports yet.");
  for (const r of rows) console.log(`${r.done ? "done   " : "waiting"}  ${join(dir, r.d)}${r.done ? "" : "  (needs analysis.json, then zuspy finish)"}`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  switch (cmd) {
    case "spy": {
      const [service, location] = args._;
      if (!service || !location) throw new Error('Say what you sell and where: zuspy spy "garage door repair" "Phoenix, AZ"');
      const out = await spy({ service, location, business: typeof args.me === "string" ? args.me : null, rivals: args.rivals, reviews: !args["no-reviews"], ai: typeof args.ai === "string" ? args.ai : undefined });
      if (out.done && args.open) openFile(join(out.dir, "report.html"));
      return;
    }
    case "finish": {
      const dir = reportFolder(args._[0]);
      finish(dir);
      if (args.open) openFile(join(dir, "report.html"));
      return;
    }
    case "rebuild": {
      const dir = reportFolder(args._[0]);
      const report = JSON.parse(readFileSync(join(dir, "report.json"), "utf8"));
      const file = renderReport(dir, report, { anonymous: !!args.anonymous });
      console.log(file);
      if (args.open) openFile(file);
      return;
    }
    case "watch": {
      if (args.remove) return watchRemove(String(args.remove));
      if (args.all) return watchCheck({ all: true, open: !!args.open });
      if (!args._[0]) return watchList();
      return watchCheck({ website: args._[0], name: typeof args.name === "string" ? args.name : null, town: typeof args.town === "string" ? args.town : null, open: !!args.open, openFile });
    }
    case "setup": {
      const out = await runSetup({ open: args["no-open"] ? null : openFile });
      if (!out.saved) return console.log("Setup closed without saving.");
      loadEnv(true);
      console.log("");
      return doctor();
    }
    case "list":
      return list();
    case "open": {
      const dir = reportFolder(args._[0]);
      return openFile(join(dir, "report.html"));
    }
    case "doctor":
      return doctor();
    case "version":
    case "--version":
      return console.log(VERSION);
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return console.log(HELP);
    default:
      throw new Error(`Unknown command "${cmd}". Run: zuspy help`);
  }
}

main().catch((e) => {
  console.error(`\nZuSpy stopped: ${e?.message ?? e}`);
  process.exit(1);
});
