// What a run cost: DataForSEO's own prices from its answers, AI tokens at Anthropic's list prices, Firecrawl credits.
import { listPrice } from "./providers/ai.mjs";

export class Meter {
  constructor() {
    this.dataforseo = 0;
    this.firecrawlCredits = 0;
    this.tokens = {};
  }

  add(what, dollars, credits = 0) {
    if (what === "dataforseo") this.dataforseo += dollars;
    if (what === "firecrawl") this.firecrawlCredits += credits;
  }

  /** Tokens Claude Code used on your Claude plan (not billed per token, so never priced). */
  addPlanTokens(input, output) {
    this.planTokens = { input: (this.planTokens?.input ?? 0) + input, output: (this.planTokens?.output ?? 0) + output };
  }

  addTokens(model, input, output) {
    const t = (this.tokens[model] ??= { input: 0, output: 0 });
    t.input += input;
    t.output += output;
  }

  get aiDollars() {
    let sum = 0;
    let known = true;
    for (const [model, t] of Object.entries(this.tokens)) {
      const p = listPrice(model, t.input, t.output);
      if (p === null) known = false;
      else sum += p;
    }
    return { sum, known };
  }

  toJSON() {
    const ai = this.aiDollars;
    return {
      dataforseo_usd: round(this.dataforseo),
      ai_tokens: this.tokens,
      ai_usd_at_list_price: ai.known ? round(ai.sum) : null,
      firecrawl_credits: this.firecrawlCredits,
      ...(this.planTokens ? { ai_plan_tokens: this.planTokens } : {}),
      total_usd: round(this.dataforseo + (ai.known ? ai.sum : 0)),
    };
  }

  line() {
    const j = this.toJSON();
    const parts = [`DataForSEO $${j.dataforseo_usd.toFixed(3)}`];
    if (Object.keys(this.tokens).length) parts.push(j.ai_usd_at_list_price === null ? "AI: see your provider" : `AI $${j.ai_usd_at_list_price.toFixed(3)} at list price`);
    if (j.ai_plan_tokens) parts.push(`${Math.round((j.ai_plan_tokens.input + j.ai_plan_tokens.output) / 1000)}k tokens on your Claude plan`);
    if (j.firecrawl_credits) parts.push(`${j.firecrawl_credits} Firecrawl credits`);
    return parts.join(", ");
  }
}

const round = (n) => Math.round(n * 10000) / 10000;
