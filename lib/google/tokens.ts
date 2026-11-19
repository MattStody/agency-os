import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { googleTokens } from "@/lib/db/schema";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
// Refresh a bit early to avoid racing token expiry mid-request.
const EXPIRY_SKEW_MS = 60_000;

interface RefreshResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

/**
 * Returns a valid Google access token for the given Boldly OS user id,
 * refreshing it via the stored refresh_token if it has expired.
 * Throws if the user has never connected Google or has no refresh_token
 * on file (re-auth required in that case).
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const db = getDb();
  const [tokenRow] = await db.select().from(googleTokens).where(eq(googleTokens.userId, userId));
  if (!tokenRow) throw new GoogleNotConnectedError(userId);

  const expiresAtMs = tokenRow.expiresAt ? tokenRow.expiresAt.getTime() : 0;
  if (Date.now() + EXPIRY_SKEW_MS < expiresAtMs) return tokenRow.accessToken;

  if (!tokenRow.refreshToken) throw new GoogleNotConnectedError(userId);

  const refreshed = await refreshAccessToken(tokenRow.refreshToken);
  await db
    .update(googleTokens)
    .set({
      accessToken: refreshed.access_token,
      expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      scope: refreshed.scope,
      tokenType: refreshed.token_type,
    })
    .where(eq(googleTokens.userId, userId));

  return refreshed.access_token;
}

/** Stores the Google tokens from a sign-in. Keeps the old refresh_token if Google didn't send a new one. */
export async function storeGoogleTokens(
  userId: string,
  tokens: { accessToken: string; refreshToken?: string | null; expiresAt?: Date | null; scope: string }
) {
  const values = {
    userId,
    accessToken: tokens.accessToken,
    expiresAt: tokens.expiresAt ?? null,
    scope: tokens.scope,
    tokenType: "Bearer",
    ...(tokens.refreshToken ? { refreshToken: tokens.refreshToken } : {}),
  };
  await getDb()
    .insert(googleTokens)
    .values(values)
    .onConflictDoUpdate({ target: googleTokens.userId, set: values });
}

async function refreshAccessToken(refreshToken: string): Promise<RefreshResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET must be set to refresh Google tokens"
    );
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Google token refresh failed (${response.status}): ${body}`);
  }

  return response.json();
}

export class GoogleNotConnectedError extends Error {
  constructor(userId: string) {
    super(`No Google connection on file for user ${userId}. Re-authentication required.`);
    this.name = "GoogleNotConnectedError";
  }
}
