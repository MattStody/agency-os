export interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

/**
 * Private object storage. Objects are never public: the app hands out
 * short-lived signed URLs after its own permission checks.
 */
export interface StorageDriver {
  readonly name: "local" | "supabase" | "memory";
  /** A one-off URL the browser can PUT the file to directly (bypasses app body-size limits). */
  createUploadTarget(key: string, contentType: string, maxBytes: number): Promise<UploadTarget>;
  /** A short-lived URL to view/download an object. */
  signedUrl(key: string, expiresInS?: number): Promise<string>;
  /** Size in bytes if the object exists, else null. */
  stat(key: string): Promise<{ size: number } | null>;
  /** Server-side write (seeds, tests). */
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
}
