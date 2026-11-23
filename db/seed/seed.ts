// Inserts the demo data using the owner connection (bypasses RLS by design).
// Idempotent: existing demo rows (matched by fixed id) are left as they are.
import { sql } from "drizzle-orm";
import {
  activityLog,
  clientChannels,
  clientContacts,
  clients,
  memberships,
  users,
} from "@/lib/db/schema";
import { rowsOf, type Db } from "@/lib/db/types";
import type { StorageDriver } from "@/lib/storage/types";
import { seedApprovals } from "./approvals";
import { DEMO_IDS, demoActivity, demoClients, demoUsers } from "./data";

export async function seedDemo(db: Db, storage?: StorageDriver): Promise<{ inserted: boolean; approvals: boolean }> {
  const core = await seedCore(db);
  const approvals = storage ? (await seedApprovals(db, storage)).inserted : false;
  return { inserted: core.inserted, approvals };
}

async function seedCore(db: Db): Promise<{ inserted: boolean }> {
  const existing = await db.execute(sql`select 1 from clients where id = ${DEMO_IDS.clients.harbourline}`);
  if (rowsOf(existing).length > 0) return { inserted: false };

  await db.transaction(async (tx) => {
    for (const c of demoClients) {
      const { channels, contacts, ...client } = c;
      await tx.insert(clients).values(client);
      await tx.insert(clientChannels).values(channels.map((ch) => ({ ...ch, clientId: c.id })));
      await tx.insert(clientContacts).values(contacts.map((ct) => ({ ...ct, clientId: c.id })));
    }
    for (const u of demoUsers) {
      await tx
        .insert(users)
        .values({ id: u.id, email: u.email, name: u.name, title: u.title })
        .onConflictDoNothing();
      await tx.insert(memberships).values({ userId: u.id, clientId: u.clientId, role: u.role });
    }
    const now = Date.now();
    await tx.insert(activityLog).values(
      demoActivity.map(([clientKey, actor, minutesAgo, module, action, summary]) => ({
        clientId: clientKey ? DEMO_IDS.clients[clientKey] : null,
        actorId: DEMO_IDS.users[actor],
        module,
        action,
        summary,
        createdAt: new Date(now - minutesAgo * 60_000),
      }))
    );
  });
  return { inserted: true };
}
