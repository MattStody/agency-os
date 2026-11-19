import { NextResponse, type NextRequest } from "next/server";
import { logActivity } from "@/lib/activity";
import { loadAccess, provisionConfigFromEnv, provisionOnSignIn } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { withAccess } from "@/lib/db/scoped";
import { storeGoogleTokens } from "@/lib/google";
import { GOOGLE_SCOPES } from "@/lib/google/scopes";
import { createClient } from "@/lib/supabase/server";

function safeNext(next: string | null): string {
  // Only allow same-site relative paths (no protocol-relative //evil.com).
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const fail = (msg: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);

  const errorDescription = searchParams.get("error_description");
  if (errorDescription) return fail(errorDescription);
  if (!code) return fail("Missing OAuth code");

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user?.email) {
    return fail(error?.message ?? "Sign-in failed");
  }
  const { session, user } = data;

  const db = getDb();
  const result = await provisionOnSignIn(
    db,
    {
      authUserId: user.id,
      email: user.email!,
      name: (user.user_metadata?.full_name as string | undefined) ?? null,
      avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    },
    provisionConfigFromEnv()
  );

  if (!result.ok) {
    await supabase.auth.signOut();
    return fail(result.reason);
  }

  if (session.provider_token) {
    try {
      await storeGoogleTokens(result.userId, {
        accessToken: session.provider_token,
        refreshToken: session.provider_refresh_token,
        // Google access tokens last ~1h; Supabase doesn't expose the provider expiry.
        expiresAt: new Date(Date.now() + 55 * 60_000),
        scope: GOOGLE_SCOPES,
      });
    } catch (e) {
      console.error("Failed to store Google tokens:", e);
    }
  }

  if (result.created) {
    const access = await loadAccess(db, result.userId);
    if (access) {
      await withAccess(db, access, (tx) =>
        logActivity(tx, access, {
          clientId: null,
          module: "core",
          action: "team.joined",
          entityType: "user",
          entityId: result.userId,
          summary: `${access.name ?? access.email} signed in for the first time`,
        })
      );
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
