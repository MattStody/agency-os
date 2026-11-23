import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localDriver, localPath } from "@/lib/storage/local";
import { isSafeKey, signFile, verifyFile } from "@/lib/storage/signing";

const env = { ...process.env };
beforeEach(() => {
  process.env.AUTH_SECRET = "s".repeat(40);
  process.env.LOCAL_STORAGE_DIR = mkdtempSync(path.join(os.tmpdir(), "boldly-storage-"));
});
afterEach(() => {
  process.env = { ...env };
});

describe("storage keys", () => {
  it("rejects traversal and odd characters", () => {
    expect(isSafeKey("clients/a/approvals/b/c/d.mp4")).toBe(true);
    for (const bad of ["../etc/passwd", "a/../../b", "/abs", "a//b", "a/./b", "a b", "a\\b", ""]) {
      expect(isSafeKey(bad), bad).toBe(false);
    }
    expect(() => localPath("../x")).toThrow();
  });
});

describe("signed file URLs", () => {
  it("verify only for the same op, key, expiry and constraints", () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const sig = signFile("get", "k/a.jpg", exp);
    expect(verifyFile("get", "k/a.jpg", exp, sig)).toBe(true);
    expect(verifyFile("put", "k/a.jpg", exp, sig)).toBe(false);
    expect(verifyFile("get", "k/b.jpg", exp, sig)).toBe(false);
    expect(verifyFile("get", "k/a.jpg", exp + 1, sig)).toBe(false);
    const put = signFile("put", "k/a.jpg", exp, "image/png\n100");
    expect(verifyFile("put", "k/a.jpg", exp, put, "image/png\n999999")).toBe(false);
  });

  it("expire", () => {
    const exp = Math.floor(Date.now() / 1000) - 1;
    expect(verifyFile("get", "k", exp, signFile("get", "k", exp))).toBe(false);
  });

  it("local driver round-trips and issues verifiable URLs", async () => {
    const d = localDriver();
    await d.put("clients/x/a.jpg", new Uint8Array([1, 2, 3]), "image/jpeg");
    expect(await d.stat("clients/x/a.jpg")).toEqual({ size: 3 });
    const url = new URL(await d.signedUrl("clients/x/a.jpg", 60), "http://h");
    expect(url.pathname).toBe("/api/files/clients/x/a.jpg");
    expect(verifyFile("get", "clients/x/a.jpg", Number(url.searchParams.get("exp")), url.searchParams.get("sig")!)).toBe(true);
    await d.remove(["clients/x/a.jpg"]);
    expect(await d.stat("clients/x/a.jpg")).toBeNull();
  });
});
