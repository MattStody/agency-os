import "server-only";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Read path: the signed-in agency user, scoped to the `reporting` schema.
 * RLS lets any authenticated user read reporting data (see 0003_reporting.sql).
 *
 * Requires `reporting` in Supabase → Project Settings → API → Exposed schemas.
 */
export function reportingDb() {
  return createClient().schema("reporting");
}

/**
 * Write path: the sync/normalization job. Service role bypasses RLS — never
 * reach for this from anything that renders for a client.
 */
export function reportingAdminDb() {
  return createServiceRoleClient().schema("reporting");
}
