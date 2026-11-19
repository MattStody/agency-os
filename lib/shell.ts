import "server-only";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db/client";
import { getClientBySlug, listClients } from "@/modules/core/service";
import { LAST_CLIENT_COOKIE } from "./auth/constants";
import { requireAccess } from "./auth/session";

/** Clients the current user can switch between (non-archived). Cached per request. */
export const getSwitcherClients = cache(async () => {
  const access = await requireAccess();
  const list = await listClients(getDb(), access);
  return list.map((c) => ({ id: c.id, slug: c.slug, name: c.name, status: c.status }));
});

/** Resolves /c/[client] for the current user, or 404s (also when it's another org's client). */
export const requireClient = cache(async (slug: string) => {
  const access = await requireAccess();
  const client = await getClientBySlug(getDb(), access, slug);
  if (!client) notFound();
  return { access, client };
});

export function lastClientSlug(): string | null {
  return cookies().get(LAST_CLIENT_COOKIE)?.value ?? null;
}
