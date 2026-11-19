// Minimal, driver-agnostic migration runner: applies db/migrations/*.sql in
// filename order, once each, recording them in public._migrations.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface MigrationTarget {
  /** Execute a multi-statement SQL string. */
  exec(sql: string): Promise<unknown>;
  /** Run a single parameterless query and return rows. */
  rows<T>(sql: string): Promise<T[]>;
}

export const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

export async function migrate(target: MigrationTarget, dir = MIGRATIONS_DIR): Promise<string[]> {
  await target.exec(
    `create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())`
  );
  const applied = new Set(
    (await target.rows<{ name: string }>(`select name from public._migrations`)).map((r) => r.name)
  );
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const body = readFileSync(path.join(dir, file), "utf8");
    const name = file.replace(/'/g, "''");
    await target.exec(`begin;\n${body}\ninsert into public._migrations (name) values ('${name}');\ncommit;`);
    ran.push(file);
  }
  return ran;
}
