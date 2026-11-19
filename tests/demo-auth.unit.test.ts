import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDemoToken, isDemoLoginEnabled, verifyDemoToken } from "@/lib/auth/demo";

const env = { ...process.env };
beforeEach(() => {
  process.env.AUTH_SECRET = "x".repeat(40);
});
afterEach(() => {
  process.env = { ...env };
});

describe("demo sign-in", () => {
  it("round-trips a signed token", () => {
    expect(verifyDemoToken(createDemoToken("user-1"))).toBe("user-1");
  });

  it("rejects tampered and expired tokens", () => {
    const token = createDemoToken("user-1");
    expect(verifyDemoToken(token.replace("user-1", "user-2"))).toBeNull();
    expect(verifyDemoToken(createDemoToken("user-1", Date.now() - 13 * 3600_000))).toBeNull();
    expect(verifyDemoToken("garbage")).toBeNull();
  });

  it("is never enabled on Vercel production", () => {
    process.env.DEMO_LOGIN = "true";
    process.env.VERCEL_ENV = "production";
    expect(isDemoLoginEnabled()).toBe(false);
    process.env.VERCEL_ENV = "preview";
    expect(isDemoLoginEnabled()).toBe(true);
  });
});
