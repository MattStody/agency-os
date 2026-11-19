"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { loadAccess } from "@/lib/auth/access";
import { DEMO_COOKIE } from "@/lib/auth/constants";
import { createDemoToken, DEMO_COOKIE_MAX_AGE_S, isDemoLoginEnabled } from "@/lib/auth/demo";
import { getDb } from "@/lib/db/client";
import { GOOGLE_SCOPES } from "@/lib/google/scopes";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function safeNext(next?: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export async function signInWithGoogle(nextPath?: string) {
  if (!isSupabaseConfigured()) {
    redirect(`/login?error=${encodeURIComponent("Google sign-in isn't configured on this deployment.")}`);
  }
  const supabase = createClient();
  const origin = headers().get("origin");
  const redirectTo = new URL("/api/auth/callback", origin ?? undefined);
  if (nextPath) redirectTo.searchParams.set("next", safeNext(nextPath));

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
      scopes: GOOGLE_SCOPES,
      queryParams: {
        access_type: "offline", // needed for a refresh_token
        prompt: "consent",
        ...(process.env.ALLOWED_EMAIL_DOMAINS?.split(",").length === 1
          ? { hd: process.env.ALLOWED_EMAIL_DOMAINS.trim() } // pre-select the Workspace domain
          : {}),
      },
    },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  if (data.url) redirect(data.url);
}

export async function signInAsDemoUser(formData: FormData) {
  if (!isDemoLoginEnabled()) redirect("/login");
  const userId = String(formData.get("userId") ?? "");
  const access = await loadAccess(getDb(), userId);
  if (!access) redirect(`/login?error=${encodeURIComponent("That demo user isn't available.")}`);
  cookies().set(DEMO_COOKIE, createDemoToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DEMO_COOKIE_MAX_AGE_S,
  });
  redirect(safeNext(String(formData.get("next") ?? "")));
}
