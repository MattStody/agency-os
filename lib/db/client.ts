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
    globalForDb.__boldlyPool = new Pool({ ...connectionOptions(connectionString), max: Number(process.env.DATABASE_POOL_MAX ?? 5) });
  }
  return globalForDb.__boldlyPool;
}

/**
 * Hosted Postgres (Supabase) needs TLS. node-postgres treats `sslmode=require`
 * in the URL as full certificate verification, which fails on Supabase's
 * pooler chain, so we strip it and configure TLS here instead.
 * Set DATABASE_SSL=verify (and NODE_EXTRA_CA_CERTS) for strict verification, or off to disable.
 */
export function connectionOptions(connectionString: string) {
  const url = new URL(connectionString);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  url.searchParams.delete("sslmode");
  const mode = process.env.DATABASE_SSL ?? (local ? "off" : "on");
  return {
    connectionString: url.toString(),
    ssl: mode === "off" ? undefined : { rejectUnauthorized: mode === "verify" },
  };
}

let db: Db | undefined;

/** Owner-role database handle. Use directly ONLY for auth bootstrap, migrations and seeds. */
export function getDb(): Db {
  if (!db) db = drizzle(getPool(), { schema }) as unknown as Db;
  return db;
}
