import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

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
 * Returns a valid Google access token for the given Supabase user,
 * refreshing it via the stored refresh_token if it has expired.
 * Throws if the user has never connected Google or has no refresh_token
 * on file (re-auth required in that case).
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const supabase = createServiceRoleClient();

  const { data: tokenRow, error } = await supabase
    .from("google_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load Google tokens: ${error.message}`);
  if (!tokenRow) throw new GoogleNotConnectedError(userId);

  const expiresAtMs = tokenRow.expires_at
    ? new Date(tokenRow.expires_at).getTime()
    : 0;
  const isExpired = Date.now() + EXPIRY_SKEW_MS >= expiresAtMs;

  if (!isExpired) {
    return tokenRow.access_token;
  }

  if (!tokenRow.refresh_token) {
    throw new GoogleNotConnectedError(userId);
  }

  const refreshed = await refreshAccessToken(tokenRow.refresh_token);
  const newExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000
  ).toISOString();

  const { error: updateError } = await supabase
    .from("google_tokens")
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      scope: refreshed.scope,
      token_type: refreshed.token_type,
    })
    .eq("user_id", userId);

  if (updateError) {
    console.error("Failed to persist refreshed Google token:", updateError.message);
  }

  return refreshed.access_token;
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
