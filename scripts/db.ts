// npm run db:migrate | db:seed | db:reset
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { seedDemo } from "@/db/seed/seed";
import { migrate } from "@/lib/db/migrate";
import { getStorage } from "@/lib/storage";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import { loadEnv } from "./env";

loadEnv();

async function main() {
  const cmd = process.argv[2];
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    if (cmd === "reset") {
      const host = new URL(url).hostname;
      if (!["localhost", "127.0.0.1", "::1"].includes(host) && !process.argv.includes("--force")) {
        throw new Error(`Refusing to reset non-local database at ${host}. Pass --force if you really mean it.`);
      }
      await client.query(`drop schema if exists public cascade; drop schema if exists app cascade; create schema public;`);
      console.log("Dropped public + app schemas.");
    }
    if (cmd === "migrate" || cmd === "reset") {
      const ran = await migrate({
        exec: (sql) => client.query(sql),
        rows: async (sql) => (await client.query(sql)).rows,
      }).catch(async (e) => {
        await client.query("rollback").catch(() => {});
        throw e;
      });
      console.log(ran.length ? `Applied: ${ran.join(", ")}` : "Database is up to date.");
    }
    if (cmd === "seed" || cmd === "reset") {
      const db = drizzle(client, { schema }) as unknown as Db;
      const storage = getStorage();
      const { inserted, approvals } = await seedDemo(db, storage);
      console.log(inserted ? "Seeded 3 demo clients and 3 demo users." : "Demo clients already present; skipped.");
      console.log(approvals ? `Seeded 6 demo approval items (media → ${storage.name} storage).` : "Demo approvals already present; skipped.");
    }
    if (!["migrate", "seed", "reset"].includes(cmd ?? "")) {
      console.log("Usage: tsx scripts/db.ts <migrate|seed|reset>");
      process.exitCode = 1;
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
