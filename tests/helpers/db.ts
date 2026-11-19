// Spins up an in-process Postgres (PGlite), applies the real migrations and
// seeds the demo data. RLS, roles and policies behave as in production.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { seedDemo } from "@/db/seed/seed";
import { migrate } from "@/lib/db/migrate";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { buildAccess, type Access } from "@/lib/permissions";
import { DEMO_IDS, demoUsers } from "@/db/seed/data";

export interface TestDb {
  db: Db;
  pg: PGlite;
  close(): Promise<void>;
}

export async function createTestDb({ seed = true } = {}): Promise<TestDb> {
  const pg = new PGlite();
  await migrate({
    exec: (s) => pg.exec(s),
    rows: async (s) => (await pg.query(s)).rows as never[],
  });
  const db = drizzle(pg, { schema }) as unknown as Db;
  if (seed) await seedDemo(db);
  return { db, pg, close: () => pg.close() };
}

type DemoUserKey = keyof typeof DEMO_IDS.users;

/** Access for a seeded demo user, built the same way the app builds it. */
export function demoAccess(key: DemoUserKey): Access {
  const u = demoUsers.find((d) => d.id === DEMO_IDS.users[key])!;
  const access = buildAccess(
    { id: u.id, email: u.email, name: u.name, isActive: true },
    [{ role: u.role, clientId: u.clientId }]
  );
  if (!access) throw new Error(`no access for ${key}`);
  return access;
}

/** An internal team member restricted to specific clients (supported by the model). */
export function restrictedTeamAccess(clientIds: string[]): Access {
  const access = buildAccess(
    { id: DEMO_IDS.users.specialist, email: "jordan.lee@demo.boldlyos.test", name: "Jordan Lee", isActive: true },
    clientIds.map((clientId) => ({ role: "team" as const, clientId }))
  );
  if (!access) throw new Error("no access");
  return access;
}
