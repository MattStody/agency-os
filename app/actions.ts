"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE } from "@/lib/auth/constants";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  cookies().delete(DEMO_COOKIE);
  if (isSupabaseConfigured()) {
    await createClient().auth.signOut();
  }
  redirect("/login");
}
