// Picks the storage driver from env: Supabase Storage when configured
// (SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL), else local disk.
import { localDriver } from "./local";
import { supabaseDriver } from "./supabase";
import type { StorageDriver } from "./types";

export type { StorageDriver, UploadTarget } from "./types";

let override: StorageDriver | null = null;
let cached: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (override) return override;
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
  return cached;
}

/** Tests only. */
export function setStorageForTests(driver: StorageDriver | null) {
  override = driver;
}
