import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_ROOT } from "../config.js";

const AVATAR_URL = "https://avatars.githubusercontent.com/u/183139599?s=240&v=4";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function createCreatorAvatarCache({
  directory = path.join(DATA_ROOT, ".local", "cache", "creator-avatar"),
  fetchImpl = fetch,
  timeoutMs = 3000,
} = {}) {
  const imagePath = path.join(directory, "avatar.bin");
  const metadataPath = path.join(directory, "metadata.json");
  let currentRefresh = null;

  function readCached() {
    try {
      const image = fs.readFileSync(imagePath);
      const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
      if (!ALLOWED_TYPES.has(metadata.contentType) || image.length === 0 || image.length > MAX_AVATAR_BYTES) return null;
      return { image, contentType: metadata.contentType, etag: metadata.etag || "" };
    } catch {
      return null;
    }
  }

  function save(image, metadata) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const temporaryImage = `${imagePath}.${process.pid}.tmp`;
    const temporaryMetadata = `${metadataPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryImage, image, { mode: 0o600 });
    fs.writeFileSync(temporaryMetadata, JSON.stringify(metadata), { mode: 0o600 });
    fs.renameSync(temporaryImage, imagePath);
    fs.renameSync(temporaryMetadata, metadataPath);
  }

  async function refresh() {
    const cached = readCached();
    const headers = cached?.etag ? { "If-None-Match": cached.etag } : {};
    try {
      const response = await fetchImpl(AVATAR_URL, { headers, signal: globalThis.AbortSignal.timeout(timeoutMs) });
      if (response.status === 304 && cached) return cached;
      if (!response.ok) return cached;
      const contentType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_TYPES.has(contentType)) return cached;
      const image = Buffer.from(await response.arrayBuffer());
      if (image.length === 0 || image.length > MAX_AVATAR_BYTES) return cached;
      const etag = response.headers.get("etag") || `"${crypto.createHash("sha256").update(image).digest("hex")}"`;
      if (!cached || cached.etag !== etag) save(image, { contentType, etag });
      return { image, contentType, etag };
    } catch {
      return cached;
    }
  }

  return {
    async get() {
      currentRefresh ||= refresh().finally(() => { currentRefresh = null; });
      return currentRefresh;
    },
  };
}
