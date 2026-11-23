// Supabase Storage (production). Uses the service-role key server-side only;
// the bucket must be PRIVATE. Browsers upload straight to Supabase with a
// one-off signed upload URL, so large videos never pass through Vercel.
import { createClient } from "@supabase/supabase-js";
import type { StorageDriver } from "./types";

export function supabaseDriver(url: string, serviceKey: string, bucket: string): StorageDriver {
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const b = () => client.storage.from(bucket);

  return {
    name: "supabase",
    async createUploadTarget(key, contentType) {
      const { data, error } = await b().createSignedUploadUrl(key);
      if (error || !data) throw new Error(`Could not create upload URL: ${error?.message}`);
      return {
        url: data.signedUrl,
        method: "PUT",
        headers: { "content-type": contentType, "x-upsert": "false", "cache-control": "3600" },
      };
    },
    async signedUrl(key, expiresInS = 60 * 60) {
      const { data, error } = await b().createSignedUrl(key, expiresInS);
      if (error || !data) throw new Error(`Could not sign URL: ${error?.message}`);
      return data.signedUrl;
    },
    async stat(key) {
      const { data, error } = await b().info(key);
      if (error || !data) return null;
      return { size: Number(data.size ?? data.metadata?.size ?? 0) };
    },
    async put(key, body, contentType) {
      const { error } = await b().upload(key, body, { contentType, upsert: true });
      if (error) throw new Error(`Upload failed for ${key}: ${error.message}`);
    },
    async remove(keys) {
      if (keys.length === 0) return;
      const { error } = await b().remove(keys);
      if (error) throw new Error(`Delete failed: ${error.message}`);
    },
  };
}
