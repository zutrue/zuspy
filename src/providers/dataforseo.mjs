// DataForSEO (https://dataforseo.com): Google Maps results, a business's Google reviews sorted any way, and Google's
// Ads Transparency Center. Pay as you go; every call's real price comes back in its answer and is added to the meter.
//
// Measured 2026-11: a Maps search ~$0.002, a review task ~$0.00075 per 10 reviews, an Ads Transparency lookup ~$0.002,
// a Google search ~$0.002.
export const API = "https://api.dataforseo.com/v3";
export const US = 2840;

export class DataForSeo {
  constructor(auth, meter) {
    this.auth = auth;
    this.meter = meter;
  }

  async post(path, tasks, timeoutMs) {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: this.auth, "Content-Type": "application/json" },
      body: JSON.stringify(tasks),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const j = await r.json().catch(() => null);
    if (j && Number.isFinite(Number(j.cost))) this.meter?.add("dataforseo", Number(j.cost));
    if (r.status === 401 || j?.status_code === 40100 || j?.status_code === 40101) throw new Error("DataForSEO turned the login down. Check DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD (the API password, not your website password).");
    if (j?.status_code === 40200 || j?.status_code === 40210) throw new Error("Your DataForSEO balance is empty. Add funds at https://app.dataforseo.com/.");
    if (!r.ok || !j || j.status_code !== 20000) throw new Error(`DataForSEO answered ${r.status} ${j?.status_code ?? ""} ${j?.status_message ?? ""}`.trim());
    return j;
  }

  async get(path, timeoutMs) {
    const r = await fetch(`${API}${path}`, { headers: { Authorization: this.auth }, signal: AbortSignal.timeout(timeoutMs) });
    const j = await r.json().catch(() => null);
    if (j && Number.isFinite(Number(j.cost))) this.meter?.add("dataforseo", Number(j.cost));
    return j;
  }

  /** Google Maps as a searcher in the US sees it: the listings in order (ads and organic). */
  async maps(keyword, depth = 20) {
    const j = await this.post("/serp/google/maps/live/advanced", [{ keyword: keyword.slice(0, 200), location_code: US, language_code: "en", device: "desktop", depth }], 60_000);
    const task = j.tasks?.[0];
    if (Number(task?.status_code) !== 20000) throw new Error(`Google Maps search failed: ${task?.status_message ?? "no answer"}`);
    return task.result?.[0]?.items ?? [];
  }

  /**
   * One live Google search as a phone in that place sees it (where Local Services Ads show). `where` is
   * { location_name } or { location_coordinate }. Throws with `.code` when the task is refused (40501: unknown place).
   */
  async search(keyword, where, device = "mobile") {
    const j = await this.post("/serp/google/organic/live/advanced", [{ keyword: keyword.slice(0, 200), ...where, language_code: "en", device, depth: 10 }], 60_000);
    const task = j.tasks?.[0];
    if (Number(task?.status_code) !== 20000) {
      const e = new Error(`Google search failed: ${task?.status_message ?? "no answer"}`);
      e.code = Number(task?.status_code ?? 0);
      throw e;
    }
    return task.result?.[0]?.items ?? [];
  }

  /**
   * Starts review tasks (there's no live endpoint: a task is posted and read back when ready, usually in a minute or
   * two). Returns the task ids in order, null where one was refused.
   */
  async postReviews(tasks) {
    if (!tasks.length) return [];
    const j = await this.post("/business_data/google/reviews/task_post", tasks.map(reviewTask), 30_000);
    return (j.tasks ?? []).map((t) => (t?.status_code === 20100 && typeof t.id === "string" ? t.id : null));
  }

  async readReviews(id) {
    const j = await this.get(`/business_data/google/reviews/task_get/${encodeURIComponent(id)}`, 20_000);
    const task = j?.tasks?.[0];
    const code = Number(task?.status_code ?? 0);
    // 40601 handed / 40602 in queue: not yet.
    if (code === 40601 || code === 40602 || code === 40100) return { done: false, failed: false, reviews: [] };
    if (code !== 20000) return { done: true, failed: true, reviews: [] };
    const res = task?.result?.[0];
    const reviews = (res?.items ?? []).map(reviewFromItem).filter(Boolean);
    return { done: true, failed: false, reviews, rating: Number(res?.rating?.value) || null, count: Number(res?.reviews_count) || null };
  }

  /** Polls review tasks until each is done or the deadline passes. */
  async waitForReviews(ids, deadline, everyMs = 6_000, onTick) {
    const out = ids.map(() => null);
    while (Date.now() < deadline) {
      const pending = ids.map((id, i) => ({ id, i })).filter((x) => x.id && !out[x.i]?.done);
      if (!pending.length) break;
      await Promise.all(
        pending.map(async ({ id, i }) => {
          try {
            const s = await this.readReviews(id);
            if (s.done) out[i] = s;
          } catch {
            /* read again next time */
          }
        }),
      );
      onTick?.(out.filter((s) => s?.done).length, ids.filter(Boolean).length);
      if (ids.every((id, i) => !id || out[i]?.done)) break;
      await new Promise((r) => setTimeout(r, everyMs));
    }
    return out;
  }

  /**
   * Google's Ads Transparency Center for a domain: up to 40 ads. `read: false` when it couldn't be asked; 40102 means
   * Google has nothing for the domain.
   */
  async googleAds(host, timeoutMs = 45_000) {
    try {
      const j = await this.post("/serp/google/ads_search/live/advanced", [{ target: host, location_code: US, platform: "all", format: "all", depth: 40 }], timeoutMs);
      const task = j.tasks?.[0];
      const code = Number(task?.status_code ?? 0);
      if (code === 40102) return { read: true, items: [] };
      if (code !== 20000) return { read: false, items: [] };
      return { read: true, items: task?.result?.[0]?.items ?? [] };
    } catch {
      return { read: false, items: [] };
    }
  }
}

/** A review task as DataForSEO takes it; a place's own spot when known, else the US. */
export function reviewTask(t) {
  const task = {
    place_id: t.placeId,
    sort_by: t.sort,
    depth: Math.max(10, Math.min(200, Math.round(t.depth / 10) * 10)),
    language_code: "en",
    priority: 2,
  };
  if (Number.isFinite(t.lat) && Number.isFinite(t.lng)) task.location_coordinate = `${Number(t.lat).toFixed(7)},${Number(t.lng).toFixed(7)},5000`;
  else task.location_code = US;
  if (t.tag) task.tag = String(t.tag).slice(0, 255);
  return task;
}

/** One review as ZuSpy keeps it. */
export function reviewFromItem(it) {
  const text = String(it?.review_text ?? it?.original_review_text ?? "").replace(/\s+/g, " ").trim();
  const stars = Number(it?.rating?.value ?? it?.rating ?? 0);
  if (!text || !(stars >= 1 && stars <= 5)) return null;
  const at = typeof it?.timestamp === "string" ? new Date(it.timestamp.replace(" +00:00", "Z").replace(" ", "T")).toISOString() : null;
  return { text: text.slice(0, 3000), stars: Math.round(stars), at };
}
