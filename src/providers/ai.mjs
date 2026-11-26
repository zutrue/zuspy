// The AI that writes the report (and reads the words off Google's search-ad pictures).
//
//  - anthropic: Claude through Anthropic's official SDK (ANTHROPIC_API_KEY; ANTHROPIC_BASE_URL is respected).
//  - openai:    any OpenAI-compatible chat API (OpenRouter, Zurelay, OpenAI, a local server ...).
//  - claude-code: handled by the caller (ZuSpy writes the prompt; Claude Code answers it).
//
// Claude Sonnet 5.5 and Haiku 5.5 think before they answer unless told how much, and that thinking counts against
// max_tokens. A report-sized prompt measured 2026-11-24: default thinking ~128 s and 11.5k tokens, "low" ~45 s and
// 5k tokens for the same answer. So ZuSpy asks for low effort (ZUSPY_EFFORT to change it) and leaves room.
import { ROOT } from "../config.mjs";

/** Anthropic's SDK, loaded only when the Anthropic API is used (the other ways need no install). */
export async function anthropicSdk() {
  try {
    return (await import("@anthropic-ai/sdk")).default;
  } catch {
    throw new Error(`The Anthropic API needs ZuSpy's one dependency: run \`npm install\` in ${ROOT}.`);
  }
}

/** Anthropic's list prices per million tokens (input, output), for the cost line. */
const PRICES = [
  [/opus-5-5|opus-5\.5/, 4, 20],
  [/opus/, 5, 25],
  [/sonnet/, 2, 10],
  [/haiku-5|haiku-5\.5/, 0.1, 0.5],
  [/haiku/, 1, 5],
];
export function listPrice(model, input, output) {
  const p = PRICES.find(([re]) => re.test(String(model)));
  return p ? (input * p[1] + output * p[2]) / 1e6 : null;
}

/** Claude models that take server-side fallbacks (a declined request re-run on another Claude in the same call). */
const FALLBACK_MODELS = /^claude-(sonnet-5-5|opus-5-5|opus-5|fable-5)/;

export class Ai {
  constructor(cfg, meter) {
    this.cfg = cfg;
    this.meter = meter;
  }

  async anthropic() {
    if (!this.client) {
      const Anthropic = await anthropicSdk();
      this.Anthropic = Anthropic;
      this.client = new Anthropic({ apiKey: this.cfg.key, ...(this.cfg.baseURL ? { baseURL: this.cfg.baseURL } : {}), maxRetries: 2, timeout: 300_000 });
    }
    return this.client;
  }

  get label() {
    if (this.cfg.engine === "anthropic") return `${this.cfg.model} (Anthropic API${this.cfg.baseURL ? `, ${this.cfg.baseURL}` : ""})`;
    if (this.cfg.engine === "openai") return `${this.cfg.model} (${this.cfg.baseURL})`;
    return "Claude Code";
  }

  /**
   * One request: text (and optional images as {mediaType, base64}) in, text out. `reader` uses the small model.
   * Returns { text, cutOff }.
   */
  async ask(prompt, { images = [], maxTokens = 16_000, reader = false } = {}) {
    const model = reader ? this.cfg.readerModel : this.cfg.model;
    if (this.cfg.engine === "anthropic") return this.askAnthropic(model, prompt, images, maxTokens);
    if (this.cfg.engine === "openai") return this.askOpenAi(model, prompt, images, maxTokens);
    throw new Error("No AI is set up to write the report.");
  }

  async askAnthropic(model, prompt, images, maxTokens) {
    const body = {
      model,
      max_tokens: maxTokens,
      output_config: { effort: this.cfg.effort },
      messages: [
        {
          role: "user",
          content: [...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.mediaType, data: im.base64 } })), { type: "text", text: prompt }],
        },
      ],
    };
    const client = await this.anthropic();
    let res;
    if (FALLBACK_MODELS.test(model)) {
      try {
        res = await client.beta.messages.create({ ...body, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
      } catch (e) {
        // A gateway in front of the API may not know fallbacks yet: ask again without them.
        if (!(e instanceof this.Anthropic.BadRequestError) || !/fallback|beta/i.test(String(e.message))) throw e;
        res = await client.messages.create(body);
      }
    } else {
      res = await client.messages.create(body);
    }
    const input = Number(res.usage?.input_tokens ?? 0) + Number(res.usage?.cache_read_input_tokens ?? 0) + Number(res.usage?.cache_creation_input_tokens ?? 0);
    const output = Number(res.usage?.output_tokens ?? 0);
    this.meter?.addTokens(res.model ?? model, input, output);
    if (res.stop_reason === "refusal") throw new Error("The AI declined to write this one.");
    const text = (res.content ?? []).filter((b) => b.type === "text").map((b) => b.text).join("");
    return { text, cutOff: res.stop_reason === "max_tokens" };
  }

  async askOpenAi(model, prompt, images, maxTokens) {
    const base = this.cfg.baseURL;
    const content = images.length
      ? [{ type: "text", text: prompt }, ...images.map((im) => ({ type: "image_url", image_url: { url: `data:${im.mediaType};base64,${im.base64}` } }))]
      : prompt;
    const body = { model, max_tokens: maxTokens, messages: [{ role: "user", content }] };
    // How much the model thinks: OpenRouter's own field, else the OpenAI-style one, only for models that take it.
    if (/openrouter\.ai/.test(base)) body.reasoning = { effort: this.cfg.effort };
    else if (/claude|gpt-[5-9]|^o\d/i.test(model)) body.reasoning_effort = this.cfg.effort;
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.cfg.key}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(300_000),
      }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: { message: String(e?.message ?? e) } }) }));
      const j = await r.json().catch(() => null);
      if (r.ok && j?.choices?.[0]) {
        const u = j.usage ?? {};
        this.meter?.addTokens(j.model ?? model, Number(u.prompt_tokens ?? 0), Number(u.completion_tokens ?? 0));
        const msg = j.choices[0].message?.content;
        const text = typeof msg === "string" ? msg : Array.isArray(msg) ? msg.map((p) => p?.text ?? "").join("") : "";
        return { text, cutOff: j.choices[0].finish_reason === "length" };
      }
      lastError = `${r.status} ${j?.error?.message ?? ""}`.trim();
      if (r.status === 401 || r.status === 403) throw new Error(`The AI API turned the key down (${lastError}).`);
      if (r.status === 400 || r.status === 404) throw new Error(`The AI API refused the request (${lastError}). Check ZUSPY_MODEL.`);
      await new Promise((res) => setTimeout(res, 3_000 * (attempt + 1)));
    }
    throw new Error(`The AI API didn't answer (${lastError}).`);
  }
}
