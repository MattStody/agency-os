// Client isolation, tested at both layers: the service functions (app layer)
// and raw SQL under withAccess() (RLS), so a missing WHERE can't leak data.
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_IDS } from "@/db/seed/data";
import { listActivity } from "@/lib/activity";
import { clientChannels, clientContacts, clients } from "@/lib/db/schema";
import { withAccess } from "@/lib/db/scoped";
import { rowsOf } from "@/lib/db/types";
import { ForbiddenError, type Access } from "@/lib/permissions";
import {
  addContact,
  createClient,
  getClientBySlug,
  getClientDetail,
  inviteTeamMember,
  listClients,
  listTeam,
  setTeamRole,
  updateClient,
} from "@/modules/core/service";
import { createTestDb, demoAccess, restrictedTeamAccess, type TestDb } from "./helpers/db";

const { harbourline, northvale, escarpment } = DEMO_IDS.clients;

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

/** Drizzle wraps driver errors; match against the underlying Postgres message. */
async function expectDbError(p: Promise<unknown>, re: RegExp) {
  const err = await p.then(
    () => null,
    (e: unknown) => e as Error & { cause?: Error }
  );
  expect(err, "expected the query to fail").not.toBeNull();
  expect(`${err!.message} ${err!.cause?.message ?? ""}`).toMatch(re);
}

const rawCount = (access: Access, table: string) =>
  withAccess(t.db, access, async (tx) => {
    const r = await tx.execute(sql.raw(`select count(*)::int as n from ${table}`));
    return rowsOf<{ n: number }>(r)[0].n;
  });

describe("internal staff", () => {
  it("admin sees all three clients", async () => {
    const list = await listClients(t.db, demoAccess("admin"));
    expect(list.map((c) => c.id).sort()).toEqual([harbourline, northvale, escarpment].sort());
  });

  it("team member (all clients) sees all three clients", async () => {
    expect(await listClients(t.db, demoAccess("specialist"))).toHaveLength(3);
  });

  it("team member restricted to one client sees only that client — even with raw SQL", async () => {
    const access = restrictedTeamAccess([northvale]);
    const list = await listClients(t.db, access);
    expect(list.map((c) => c.id)).toEqual([northvale]);
    expect(await rawCount(access, "clients")).toBe(1);
    expect(await rawCount(access, "client_channels")).toBe(4); // Northvale's 4 accounts only
    await expect(getClientDetail(t.db, access, harbourline)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("client user (Harbourline)", () => {
  const access = () => demoAccess("harbourlineClient");

  it("lists only their own client", async () => {
    const list = await listClients(t.db, access());
    expect(list.map((c) => c.id)).toEqual([harbourline]);
  });

  it("cannot resolve another client's slug", async () => {
    expect(await getClientBySlug(t.db, access(), "northvale-credit-union")).toBeNull();
    expect(await getClientBySlug(t.db, access(), "harbourline-dental")).not.toBeNull();
  });

  it("is refused another client's detail at the app layer", async () => {
    await expect(getClientDetail(t.db, access(), northvale)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("RLS hides other clients' rows from unfiltered SQL", async () => {
    expect(await rawCount(access(), "clients")).toBe(1);
    expect(await rawCount(access(), "client_channels")).toBe(3);
    expect(await rawCount(access(), "client_contacts")).toBe(2);
  });

  it("cannot read the activity log or the team list", async () => {
    expect(await rawCount(access(), "activity_log")).toBe(0);
    // users: only themselves
    expect(await rawCount(access(), "users")).toBe(1);
  });

  it("RLS blocks writes to their own client record and to other clients", async () => {
    await expectDbError(
      withAccess(t.db, access(), (tx) =>
        tx.insert(clientContacts).values({ clientId: northvale, name: "Intruder" })
      ), /row-level security/);
    await expectDbError(
      withAccess(t.db, access(), (tx) =>
        tx.insert(clientContacts).values({ clientId: harbourline, name: "Self-added" })
      ), /row-level security/);
    const updated = await withAccess(t.db, access(), (tx) =>
      tx.update(clients).set({ name: "Hacked" }).where(sql`true`).returning()
    );
    expect(updated).toHaveLength(0);
  });

  it("is refused edits at the app layer", async () => {
    await expect(
      updateClient(t.db, access(), harbourline, { name: "X", slug: "harbourline-dental" })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("no context", () => {
  it("the app role with no settings sees nothing", async () => {
    const n = await t.db.transaction(async (tx) => {
      await tx.execute(sql`set local role boldly_app`);
      const r = await tx.execute(sql`select count(*)::int as n from clients`);
      return rowsOf<{ n: number }>(r)[0].n;
    });
    expect(n).toBe(0);
  });

  it("the app role cannot read Google tokens at all", async () => {
    await expectDbError(
      withAccess(t.db, demoAccess("admin"), (tx) => tx.execute(sql`select * from google_tokens`)), /permission denied/);
  });
});

describe("writes and activity log", () => {
  it("team member cannot create clients", async () => {
    await expect(
      createClient(t.db, demoAccess("specialist"), { name: "New Co", slug: "new-co" })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("admin creates a client and the activity entry lands with it", async () => {
    const admin = demoAccess("admin");
    const c = await createClient(t.db, admin, { name: "Bayfront Fitness", slug: "bayfront-fitness", services: ["SEO"] });
    const activity = await withAccess(t.db, admin, (tx) => listActivity(tx, { clientId: c.id }));
    expect(activity[0]).toMatchObject({ action: "client.created", actorName: "Alex Morgan" });
  });

  it("restricted team member's activity feed excludes other clients", async () => {
    const access = restrictedTeamAccess([escarpment]);
    const feed = await withAccess(t.db, access, (tx) => listActivity(tx, { limit: 500 }));
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((e) => e.clientSlug === null || e.clientSlug === "escarpment-brewing")).toBe(true);
  });

  it("activity cannot be forged for another actor", async () => {
    await expectDbError(
      withAccess(t.db, demoAccess("specialist"), (tx) =>
        tx.execute(sql`insert into activity_log (client_id, actor_id, module, action, summary)
          values (${harbourline}, ${DEMO_IDS.users.admin}, 'core', 'x', 'forged')`)
      ), /row-level security/);
  });

  it("team members can edit details but not change status", async () => {
    const team = demoAccess("specialist");
    const base = { name: "Escarpment Brewing Co.", slug: "escarpment-brewing", status: "active" as const };
    const c = await updateClient(t.db, team, escarpment, { ...base, notes: "Spring launch in April." });
    expect(c.notes).toBe("Spring launch in April.");
    await expect(updateClient(t.db, team, escarpment, { ...base, status: "archived" })).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it("team member adds a contact to an accessible client", async () => {
    const contact = await addContact(t.db, demoAccess("specialist"), escarpment, {
      name: "Taylor Reid",
      email: "Taylor.Reid@demo.escarpment.test",
    });
    expect(contact.email).toBe("taylor.reid@demo.escarpment.test");
  });

  it("channels from one client can't be listed under another via app queries", async () => {
    const d = await getClientDetail(t.db, demoAccess("admin"), escarpment);
    expect(d.channels.every((c) => c.clientId === escarpment)).toBe(true);
    const all = await withAccess(t.db, demoAccess("admin"), (tx) => tx.select().from(clientChannels));
    expect(all).toHaveLength(9);
  });
});

describe("team management", () => {
  it("only admins invite and change roles; nobody changes their own role", async () => {
    await expect(
      inviteTeamMember(t.db, demoAccess("specialist"), { email: "x@demo.boldlyos.test", role: "team" })
    ).rejects.toBeInstanceOf(ForbiddenError);
    const user = await inviteTeamMember(t.db, demoAccess("admin"), {
      email: "Casey.Nguyen@demo.boldlyos.test",
      name: "Casey Nguyen",
      role: "team",
    });
    expect(user.email).toBe("casey.nguyen@demo.boldlyos.test");
    await setTeamRole(t.db, demoAccess("admin"), user.id, "admin");
    const team = await listTeam(t.db, demoAccess("admin"));
    expect(team.find((m) => m.id === user.id)?.role).toBe("admin");
    expect(team.some((m) => m.email.includes("harbourline"))).toBe(false); // client users aren't staff
    await expect(
      setTeamRole(t.db, demoAccess("admin"), DEMO_IDS.users.admin, "team")
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
