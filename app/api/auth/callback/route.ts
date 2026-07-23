import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/projects";
  const errorDescription = searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("Missing OAuth code")}`
    );
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? "Sign-in failed")}`
    );
  }

  const { session, user } = data;

  // Supabase surfaces the upstream Google tokens on the session for the
  // OAuth exchange that produced it. Google only returns a refresh_token
  // on the first consent (or when prompt=consent forces re-consent), so
  // we only overwrite refresh_token here when a new one is actually sent.
  if (session.provider_token) {
    const tokenExpiresAt = session.expires_at
      ? new Date(session.expires_at * 1000).toISOString()
      : null;

    const serviceClient = createServiceRoleClient();

    const { data: existing } = await serviceClient
      .from("google_tokens")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();

    const { error: upsertError } = await serviceClient
      .from("google_tokens")
      .upsert(
        {
          user_id: user.id,
          access_token: session.provider_token,
          refresh_token:
            session.provider_refresh_token ?? existing?.refresh_token ?? null,
          scope:
            "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly",
          token_type: "Bearer",
          expires_at: tokenExpiresAt,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      console.error("Failed to store Google tokens:", upsertError.message);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
