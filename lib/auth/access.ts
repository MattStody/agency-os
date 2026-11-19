// Loads a user's Access and provisions users on sign-in. Uses the owner
// connection on purpose: this is how we find out *who* someone is, before any
// RLS scope can exist. Nothing here returns client data.
import { eq, or } from "drizzle-orm";
import { memberships, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { buildAccess, type Access } from "@/lib/permissions";

export async function loadAccess(db: Db, userId: string): Promise<Access | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;
  const ms = await db
    .select({ role: memberships.role, clientId: memberships.clientId })
    .from(memberships)
    .where(eq(memberships.userId, userId));
  return buildAccess(user, ms);
}

function csv(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export interface ProvisionConfig {
  allowedDomains: string[];
  bootstrapAdmins: string[];
}

export function provisionConfigFromEnv(): ProvisionConfig {
  return {
    allowedDomains: csv(process.env.ALLOWED_EMAIL_DOMAINS),
    bootstrapAdmins: csv(process.env.BOOTSTRAP_ADMIN_EMAILS),
  };
}

export type ProvisionResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; reason: string };

/**
 * Called after a successful Google sign-in.
 * - Known user (by auth id or email): link + update, provided they're active
 *   and have at least one membership.
 * - Unknown user on an allowed staff domain: created as a team member
 *   (or admin if listed in BOOTSTRAP_ADMIN_EMAILS) with access to all clients.
 * - Anyone else: refused.
 */
export async function provisionOnSignIn(
  db: Db,
  profile: { authUserId: string; email: string; name?: string | null; avatarUrl?: string | null },
  config: ProvisionConfig
): Promise<ProvisionResult> {
  const email = profile.email.trim().toLowerCase();
  const domain = email.split("@")[1] ?? "";

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(users)
      .where(or(eq(users.authUserId, profile.authUserId), eq(users.email, email)));

    if (existing) {
      if (!existing.isActive) return { ok: false, reason: "This account has been deactivated." };
      await tx
        .update(users)
        .set({
          authUserId: profile.authUserId,
          name: existing.name ?? profile.name ?? null,
          avatarUrl: profile.avatarUrl ?? existing.avatarUrl,
          lastSignInAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      const ms = await tx.select().from(memberships).where(eq(memberships.userId, existing.id));
      if (ms.length === 0) return { ok: false, reason: "Your account has no access yet. Ask an admin." };
      return { ok: true, userId: existing.id, created: false };
    }

    if (!config.allowedDomains.includes(domain)) {
      return { ok: false, reason: "This Google account isn't authorised for Boldly OS." };
    }

    const [user] = await tx
      .insert(users)
      .values({
        email,
        authUserId: profile.authUserId,
        name: profile.name ?? null,
        avatarUrl: profile.avatarUrl ?? null,
        lastSignInAt: new Date(),
      })
      .returning();
    await tx.insert(memberships).values({
      userId: user.id,
      clientId: null,
      role: config.bootstrapAdmins.includes(email) ? "admin" : "team",
    });
    return { ok: true, userId: user.id, created: true };
  });
}
