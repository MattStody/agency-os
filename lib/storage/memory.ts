import type { StorageDriver } from "./types";

/** In-memory driver for tests. */
export function memoryDriver(): StorageDriver & { objects: Map<string, { body: Uint8Array; contentType: string }> } {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    name: "memory",
    objects,
    async createUploadTarget(key, contentType) {
      return { url: `memory://${key}`, method: "PUT", headers: { "content-type": contentType } };
    },
    async signedUrl(key) {
      return `memory://${key}?signed=1`;
    },
    async stat(key) {
      const o = objects.get(key);
      return o ? { size: o.body.byteLength } : null;
    },
    async put(key, body, contentType) {
      objects.set(key, { body, contentType });
    },
    async remove(keys) {
      keys.forEach((k) => objects.delete(k));
    },
  };
}
