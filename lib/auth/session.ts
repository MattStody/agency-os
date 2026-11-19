import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { can, type Access, type Permission } from "@/lib/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { loadAccess } from "./access";
import { DEMO_COOKIE } from "./constants";
import { isDemoLoginEnabled, verifyDemoToken } from "./demo";

async function resolveUserId(): Promise<string | null> {
  if (isDemoLoginEnabled()) {
    const demoUserId = verifyDemoToken(cookies().get(DEMO_COOKIE)?.value);
    if (demoUserId) return demoUserId;
  }
  if (!isSupabaseConfigured()) return null;
  const {
    data: { user },
  } = await createSupabase().auth.getUser();
  if (!user) return null;
  const [row] = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(eq(users.authUserId, user.id));
  return row?.id ?? null;
}

/** The signed-in user's Access, or null. Cached per request. */
export const getAccess = cache(async (): Promise<Access | null> => {
  const userId = await resolveUserId();
  return userId ? loadAccess(getDb(), userId) : null;
});

/** Access for the current request, or redirect to /login. */
export async function requireAccess(): Promise<Access> {
  const access = await getAccess();
  if (!access) redirect("/login");
  return access;
}

/** Like requireAccess, but 404s when the user lacks the permission (no existence leak). */
export async function requirePermission(permission: Permission): Promise<Access> {
  const access = await requireAccess();
  if (!can(access, permission)) notFound();
  return access;
}
