# ZuSpy

This repo is ZuSpy: a CLI that spies on a local business's competitors. It finds who shows up first on Google Maps
for a service in a town, reads every ad those competitors run on Facebook, Instagram and Google, reads their worst
Google reviews, and writes the patterns, ads and offers that win their customers into a one-file HTML report. `watch`
checks one company again and again and lists what changed.

**When the user wants to set ZuSpy up, run a report, or research competitors, follow the `zuspy` skill
(`.claude/skills/zuspy/SKILL.md`) step by step.** In this repo the CLI is `node bin/zuspy.mjs`.

First run in a fresh clone:

1. `npm install`
2. `node bin/zuspy.mjs doctor`
3. Keys: run `node bin/zuspy.mjs setup` in the background and send the user to the page it opens. Never ask for keys
   in the chat, never print or commit them, never read `~/.zuspy/.env`.

A report costs the user a little money (DataForSEO, and the AI when they use a key): say so and get a yes before `spy`.

## Working on the code

- Node 18+, ESM, no build step. One dependency (`@anthropic-ai/sdk`), loaded only for the Anthropic API.
- `npm test` runs the tests (`node --test`).
- `src/rules/` is ported from Zuops' Competitor Spy (`_shared/competitor-spy*.ts`, `competitor-watch.ts`,
  `fb-ad-library-search.ts`): pure rules for picking rivals and ads, the prompt, checking the AI's answer, and the
  watch diff. Keep their behaviour in step with `test/spy.test.mjs`, `test/ads.test.mjs` and `test/watch.test.mjs`.
- `src/spy.mjs` is the report pipeline, `src/watch.mjs` the watch pipeline, `src/setup.mjs` the local key page,
  `src/report/` the pages (everything from the web is escaped; see `test/report.test.mjs`).
- Reports (`zuspy-reports/`) and `.env` are gitignored; never commit either.
