import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Database } from "./types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Set it in your Vercel project settings (or .env.local) and redeploy.`
    );
  }
  return value;
}

/**
 * Server Component / Route Handler client. Cookie writes are wrapped in
 * try/catch because Server Components can't set cookies — the middleware
 * is what actually persists refreshed sessions in that case.
 */
export function createClient() {
  const cookieStore = cookies();
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component; middleware handles refresh.
          }
        },
      },
    }
  );
}

/**
 * Service-role client for trusted server-side writes (e.g. persisting
 * Google OAuth tokens) that must bypass RLS. Never import this in
 * client-facing code paths.
 */
export function createServiceRoleClient() {
  return createServerClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op: service role client is not tied to a user session
        },
      },
    }
  );
}
