"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.readonly",
].join(" ");

export async function signInWithGoogle(nextPath?: string) {
  const supabase = createClient();
  const origin = headers().get("origin");

  const redirectTo = new URL("/api/auth/callback", origin ?? undefined);
  if (nextPath) redirectTo.searchParams.set("next", nextPath);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
      scopes: GOOGLE_DRIVE_SCOPES,
      queryParams: {
        // Needed to receive a refresh_token from Google and to force the
        // consent screen so a refresh_token is reissued if it was dropped.
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (data.url) {
    redirect(data.url);
  }
}
