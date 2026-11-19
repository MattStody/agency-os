import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

/** Any Drizzle Postgres handle (node-postgres in the app, PGlite in tests), or a transaction on one. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Rows from db.execute(), which is driver-typed as unknown on the generic handle. */
export function rowsOf<T = Record<string, unknown>>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}
