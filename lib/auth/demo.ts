// Demo sign-in: pick a seeded user without Google. For local dev and preview
// demos only — hard-disabled on Vercel production deployments.
import { createHmac, timingSafeEqual } from "node:crypto";

export function isDemoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN === "true" && process.env.VERCEL_ENV !== "production";
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET must be set (32+ characters) to use demo sign-in.");
  }
  return s;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Token format: `<userId>.<issuedAtMs>.<signature>` */
export function createDemoToken(userId: string, now = Date.now()): string {
  const payload = `${userId}.${now}`;
  return `${payload}.${sign(payload)}`;
}

const MAX_AGE_MS = 1000 * 60 * 60 * 12;

export function verifyDemoToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, issuedAt, sig] = parts;
  const expected = Buffer.from(sign(`${userId}.${issuedAt}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (now - Number(issuedAt) > MAX_AGE_MS) return null;
  return userId;
}

export const DEMO_COOKIE_MAX_AGE_S = MAX_AGE_MS / 1000;
