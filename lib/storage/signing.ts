// HMAC signing for the local storage driver's URLs.
import { createHmac, timingSafeEqual } from "node:crypto";

export type FileOp = "get" | "put";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET (32+ characters) is required for local file storage.");
  return s;
}

export function signFile(op: FileOp, key: string, exp: number, extra = ""): string {
  return createHmac("sha256", secret()).update(`${op}\n${key}\n${exp}\n${extra}`).digest("base64url");
}

export function verifyFile(op: FileOp, key: string, exp: number, sig: string, extra = "", now = Date.now()): boolean {
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const a = Buffer.from(signFile(op, key, exp, extra));
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Keys are app-generated, but never trust them on the way back in. */
export function isSafeKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length < 512 &&
    /^[A-Za-z0-9/_.-]+$/.test(key) &&
    !key.split("/").some((seg) => seg === "" || seg === "." || seg === "..")
  );
}
