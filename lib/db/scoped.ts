// Client-isolation choke point. Every user-facing read/write runs inside
// withAccess(): a transaction that switches to the RLS-restricted role and
// tells Postgres who the user is and which clients they may see. If an app-
// level check is ever missed, RLS still returns nothing for other clients.
import { sql } from "drizzle-orm";
import type { Access } from "@/lib/permissions";
import type { Db } from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function clientIdsSetting(access: Pick<Access, "clientIds">): string {
  if (access.clientIds === "all") return "{}";
  for (const id of access.clientIds) {
    if (!UUID_RE.test(id)) throw new Error(`Invalid client id in access scope: ${id}`);
  }
  return `{${access.clientIds.join(",")}}`;
}

export async function withAccess<T>(
  db: Db,
  access: Access,
  fn: (tx: Db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role boldly_app`);
    await tx.execute(sql`select
      set_config('app.user_id', ${access.userId}, true),
      set_config('app.role', ${access.role}, true),
      set_config('app.all_clients', ${access.clientIds === "all" ? "on" : "off"}, true),
      set_config('app.client_ids', ${clientIdsSetting(access)}, true)`);
    return fn(tx as unknown as Db);
  });
}
