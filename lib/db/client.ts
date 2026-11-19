// The app's Postgres connection. Connects as the database owner role; every
// user-facing query must go through withAccess() (lib/db/scoped.ts), which
// drops to the RLS-restricted `boldly_app` role for the transaction.
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import type { Db } from "./types";

const globalForDb = globalThis as unknown as { __boldlyPool?: Pool };

function getPool(): Pool {
  if (!globalForDb.__boldlyPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add it to .env.local (see .env.example)."
      );
    }
    globalForDb.__boldlyPool = new Pool({ connectionString, max: 10 });
  }
  return globalForDb.__boldlyPool;
}

let db: Db | undefined;

/** Owner-role database handle. Use directly ONLY for auth bootstrap, migrations and seeds. */
export function getDb(): Db {
  if (!db) db = drizzle(getPool(), { schema }) as unknown as Db;
  return db;
}
