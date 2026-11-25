// Picks the storage driver from env: Supabase Storage when configured
// (SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL), else local disk.
import { localDriver } from "./local";
import { supabaseDriver } from "./supabase";
import type { StorageDriver } from "./types";

export type { StorageDriver, UploadTarget } from "./types";

/**
 * Keys under demo/ point at the fictional sample media bundled in
 * public/demo-media, so seeded demo data works with any driver (and on
 * Vercel) without uploading anything. Never used for real client files.
 */
export const DEMO_PREFIX = "demo/";

function withDemoMedia(d: StorageDriver): StorageDriver {
  const isDemo = (k: string) => k.startsWith(DEMO_PREFIX);
  return {
    name: d.name,
    createUploadTarget: d.createUploadTarget.bind(d),
    put: d.put.bind(d),
    signedUrl: (k, e) => (isDemo(k) ? Promise.resolve(`/demo-media/${k.slice(DEMO_PREFIX.length)}`) : d.signedUrl(k, e)),
    stat: (k) => (isDemo(k) ? Promise.resolve(null) : d.stat(k)),
    remove: (keys) => d.remove(keys.filter((k) => !isDemo(k))),
  };
}

let override: StorageDriver | null = null;
let cached: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (override) return withDemoMedia(override);
  if (!cached) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      cached = supabaseDriver(url, key, process.env.STORAGE_BUCKET ?? "boldly-os");
    } else {
      if (process.env.VERCEL_ENV === "production") {
        throw new Error("File storage isn't configured: set SUPABASE_SERVICE_ROLE_KEY and STORAGE_BUCKET.");
      }
      cached = localDriver();
    }
  }
  return withDemoMedia(cached);
}

/** Tests only. */
export function setStorageForTests(driver: StorageDriver | null) {
  override = driver;
}
