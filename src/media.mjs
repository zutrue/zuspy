// The ad libraries' picture and video links stop working within hours, so a report keeps its own copies in its
// folder (media/). The report's page and JSON point at those files.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchPublic, BROWSER_UA } from "./http.mjs";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4" };

/** Copies a file into <dir>/media/; its path relative to <dir>, or null when it couldn't be copied. */
export async function keep(dir, url, name, kind) {
  const got = await fetchPublic(url, {
    maxBytes: kind === "video" ? 40 * 1024 * 1024 : 8 * 1024 * 1024,
    timeoutMs: kind === "video" ? 90_000 : 25_000,
    headers: { "User-Agent": BROWSER_UA },
  });
  if (!got.ok || got.bytes.byteLength < 500) return null;
  const type = got.contentType.split(";")[0].trim().toLowerCase();
  const contentType = kind === "video" ? "video/mp4" : EXT[type] ? type : "image/jpeg";
  const file = `media/${name.replace(/[^a-z0-9_-]/gi, "_")}.${EXT[contentType]}`;
  mkdirSync(join(dir, "media"), { recursive: true });
  writeFileSync(join(dir, file), got.bytes);
  return file;
}

export const mediaTypeOf = (file) => {
  const ext = String(file).split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
};
