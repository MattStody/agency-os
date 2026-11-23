// Filesystem storage for local development. Files live in LOCAL_STORAGE_DIR
// (default ./.storage) and are served by app/api/files/[...key] using HMAC-
// signed, expiring URLs — the same access model as Supabase signed URLs.
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSafeKey, signFile } from "./signing";
import type { StorageDriver } from "./types";

export function localRoot(): string {
  return path.resolve(process.env.LOCAL_STORAGE_DIR ?? path.join(process.cwd(), ".storage"));
}

export function localPath(key: string): string {
  if (!isSafeKey(key)) throw new Error("Invalid storage key");
  const root = localRoot();
  const p = path.resolve(root, key);
  if (!p.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return p;
}

const fileUrl = (key: string) => `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;

export function localDriver(): StorageDriver {
  return {
    name: "local",
    async createUploadTarget(key, contentType, maxBytes) {
      localPath(key);
      const exp = Math.floor(Date.now() / 1000) + 60 * 60;
      const extra = `${contentType}\n${maxBytes}`;
      const q = new URLSearchParams({
        exp: String(exp),
        ct: contentType,
        max: String(maxBytes),
        sig: signFile("put", key, exp, extra),
      });
      return { url: `${fileUrl(key)}?${q}`, method: "PUT", headers: { "content-type": contentType } };
    },
    async signedUrl(key, expiresInS = 60 * 60) {
      localPath(key);
      const exp = Math.floor(Date.now() / 1000) + expiresInS;
      return `${fileUrl(key)}?${new URLSearchParams({ exp: String(exp), sig: signFile("get", key, exp) })}`;
    },
    async stat(key) {
      try {
        const s = await stat(localPath(key));
        return s.isFile() ? { size: s.size } : null;
      } catch {
        return null;
      }
    },
    async put(key, body) {
      const p = localPath(key);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, body);
    },
    async remove(keys) {
      await Promise.all(keys.map((k) => rm(localPath(k), { force: true })));
    },
  };
}
