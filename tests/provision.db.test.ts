// Sign-in provisioning: who gets in, with what role.
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_IDS } from "@/db/seed/data";
import { loadAccess, provisionOnSignIn } from "@/lib/auth/access";
import { users } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "./helpers/db";

const config = { allowedDomains: ["boldlymedia.test"], bootstrapAdmins: ["owner@boldlymedia.test"] };
const authId = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

describe("provisionOnSignIn", () => {
  it("refuses unknown people outside the staff domain", async () => {
    const r = await provisionOnSignIn(t.db, { authUserId: authId(1), email: "someone@gmail.com" }, config);
    expect(r.ok).toBe(false);
  });

  it("creates staff-domain users as team members with all clients", async () => {
    const r = await provisionOnSignIn(t.db, { authUserId: authId(2), email: "New.Hire@BoldlyMedia.test", name: "New Hire" }, config);
    expect(r).toMatchObject({ ok: true, created: true });
    const access = await loadAccess(t.db, (r as { userId: string }).userId);
    expect(access).toMatchObject({ role: "team", clientIds: "all", email: "new.hire@boldlymedia.test" });
  });

  it("makes bootstrap admins admins", async () => {
    const r = await provisionOnSignIn(t.db, { authUserId: authId(3), email: "owner@boldlymedia.test" }, config);
    const access = await loadAccess(t.db, (r as { userId: string }).userId);
    expect(access?.role).toBe("admin");
  });

  it("links an invited/seeded user by email, keeping their scope", async () => {
    const r = await provisionOnSignIn(t.db, { authUserId: authId(4), email: "priya.shah@demo.harbourline.test" }, config);
    expect(r).toMatchObject({ ok: true, created: false, userId: DEMO_IDS.users.harbourlineClient });
    const access = await loadAccess(t.db, DEMO_IDS.users.harbourlineClient);
    expect(access?.clientIds).toEqual([DEMO_IDS.clients.harbourline]);
  });

  it("refuses deactivated users", async () => {
    await t.db.update(users).set({ isActive: false }).where(eq(users.id, DEMO_IDS.users.specialist));
    const r = await provisionOnSignIn(t.db, { authUserId: authId(5), email: "jordan.lee@demo.boldlyos.test" }, config);
    expect(r.ok).toBe(false);
    expect(await loadAccess(t.db, DEMO_IDS.users.specialist)).toBeNull();
  });
});
