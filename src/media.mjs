// The ad libraries' picture and video links stop working within hours, so a report keeps its own copies in its
// folder (media/). The report's page and JSON point at those files.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetchPublic, BROWSER_UA } from "./http.mjs";

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "image/x-icon": "ico" };

/** Copies a file into <dir>/media/; its path relative to <dir>, or null when it couldn't be copied. */
export async function keep(dir, url, name, kind) {
  const got = await fetchPublic(url, {
    maxBytes: kind === "video" ? 40 * 1024 * 1024 : 8 * 1024 * 1024,
    timeoutMs: kind === "video" ? 90_000 : 25_000,
    headers: { "User-Agent": BROWSER_UA },
  });
  if (!got.ok || got.bytes.byteLength < 500) return null;
  const type = got.contentType.split(";")[0].trim().toLowerCase();
  const contentType = kind === "video" ? "video/mp4" : EXT[type] && type !== "image/x-icon" ? type : "image/jpeg";
  return write(dir, name, contentType, got.bytes);
}

function write(dir, name, contentType, bytes) {
  const file = `media/${name.replace(/[^a-z0-9_-]/gi, "_")}.${EXT[contentType]}`;
  mkdirSync(join(dir, "media"), { recursive: true });
  writeFileSync(join(dir, file), bytes);
  return file;
}

const ascii = (b, from, to) => String.fromCharCode(...b.subarray(from, to));

/**
 * What a picture file really is and how big, from its first bytes (a server's content type is often wrong): PNG, JPEG,
 * GIF, WebP or ICO (its biggest image). Null when it isn't one of those.
 */
export function imageInfo(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length < 12) return null;
  const be16 = (i) => (b[i] << 8) | b[i + 1];
  const le16 = (i) => b[i] | (b[i + 1] << 8);
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return { type: "image/png", width: (be16(16) << 16) | be16(18), height: (be16(20) << 16) | be16(22) };
  if (ascii(b, 0, 4) === "GIF8") return { type: "image/gif", width: le16(6), height: le16(8) };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") {
    const kind = ascii(b, 12, 16);
    if (kind === "VP8X") return { type: "image/webp", width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
    if (kind === "VP8L") return { type: "image/webp", width: 1 + (le16(21) & 0x3fff), height: 1 + (((le16(22) >> 6) | (b[24] << 10)) & 0x3fff) };
    return { type: "image/webp", width: le16(26) & 0x3fff, height: le16(28) & 0x3fff };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    // JPEG: walk the markers to the frame header.
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return { type: "image/jpeg", width: 0, height: 0 };
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { type: "image/jpeg", width: be16(i + 7), height: be16(i + 5) };
      i += 2 + be16(i + 2);
    }
    return { type: "image/jpeg", width: 0, height: 0 };
  }
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) {
    let size = 0;
    for (let n = 0; n < le16(4) && 6 + n * 16 < b.length; n++) size = Math.max(size, b[6 + n * 16] || 256);
    return { type: "image/x-icon", width: size, height: size };
  }
  // SVG is left out on purpose: a logo file can carry scripts, and the report's folder is opened from disk.
  return null;
}

/**
 * The first of `urls` that is a real picture at least `min` pixels wide, copied into media/ as <name>.<ext>. For logos
 * and photos: a 16-pixel favicon blown up looks worse than plain initials, so it's skipped.
 */
export async function keepImage(dir, urls, name, { min = 64 } = {}) {
  for (const url of urls.filter(Boolean)) {
    const got = await fetchPublic(url, { maxBytes: 4 * 1024 * 1024, timeoutMs: 15_000, headers: { "User-Agent": BROWSER_UA } });
    if (!got.ok) continue;
    const info = imageInfo(got.bytes);
    if (!info || Math.min(info.width, info.height) < min) continue;
    return write(dir, name, info.type, got.bytes);
  }
  return null;
}

export const mediaTypeOf = (file) => {
  const ext = String(file).split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
};
