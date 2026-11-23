// Approvals: client isolation (app + RLS), the review workflow, uploads and
// notifications — against real Postgres (PGlite) with the demo seed.
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_APPROVAL_IDS } from "@/db/seed/approvals";
import { DEMO_IDS } from "@/db/seed/data";
import type { EmailMessage, EmailTransport } from "@/lib/email";
import { withAccess } from "@/lib/db/scoped";
import { rowsOf } from "@/lib/db/types";
import { listNotifications, unreadCount } from "@/lib/notifications";
import { deliverPendingEmails } from "@/lib/notifications/deliver";
import { ForbiddenError, type Access } from "@/lib/permissions";
import {
  addComment,
  ApprovalStateError,
  createAssetUpload,
  createItem,
  createVersion,
  decide,
  getItemDetail,
  listQueue,
  registerAsset,
  sendForApproval,
  setArchived,
} from "@/modules/approvals/service";
import { createTestDb, demoAccess, restrictedTeamAccess, type TestDb } from "./helpers/db";

const { harbourline, northvale, escarpment } = DEMO_IDS.clients;
const A = DEMO_APPROVAL_IDS;

let t: TestDb;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(async () => {
  await t.close();
});

const admin = () => demoAccess("admin");
const team = () => demoAccess("specialist");
const priya = () => demoAccess("harbourlineClient");

async function rawCount(access: Access, table: string) {
  return withAccess(t.db, access, async (tx) => rowsOf<{ n: number }>(await tx.execute(sql.raw(`select count(*)::int as n from ${table}`)))[0].n);
}

async function expectDbError(p: Promise<unknown>, re: RegExp) {
  const err = await p.then(
    () => null,
    (e: Error & { cause?: Error }) => e
  );
  expect(err, "expected the query to fail").not.toBeNull();
  expect(`${err!.message} ${err!.cause?.message ?? ""}`).toMatch(re);
}

/** Simulates the browser: get an upload URL, "PUT" the bytes, then register. */
async function upload(access: Access, clientId: string, itemId: string, type = "video/mp4", size = 2048) {
  const { key } = await createAssetUpload(t.db, access, clientId, itemId, { name: "clip.mp4", type, size });
  await t.storage.put(key, new Uint8Array(size), type);
  return registerAsset(t.db, access, clientId, itemId, { key, name: "clip.mp4", type, size });
}

describe("queue scoping", () => {
  it("internal staff see every client's open items, including drafts", async () => {
    const q = await listQueue(t.db, admin());
    expect(q.map((r) => r.id).sort()).toEqual(Object.values(A).sort());
  });

  it("a team member restricted to Northvale sees only Northvale", async () => {
    const q = await listQueue(t.db, restrictedTeamAccess([northvale]));
    expect(new Set(q.map((r) => r.clientId))).toEqual(new Set([northvale]));
    expect(q).toHaveLength(2);
  });

  it("a client user sees only their own client's non-draft items", async () => {
    const q = await listQueue(t.db, priya());
    expect(q.map((r) => r.id).sort()).toEqual([A.harbourlineAd, A.harbourlineClip].sort());
    await expect(listQueue(t.db, priya(), { clientId: northvale })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("RLS hides other clients, drafts and internal comments from raw SQL", async () => {
    expect(await rawCount(priya(), "approval_items")).toBe(2);
    expect(await rawCount(priya(), "approval_assets")).toBe(2);
    // Harbourline has 4 comments; 1 is Boldly-internal.
    expect(await rawCount(priya(), "approval_comments")).toBe(3);
    expect(await rawCount(restrictedTeamAccess([northvale]), "approval_versions")).toBe(3);
  });

  it("a client user can't open another client's item, or a draft", async () => {
    await expect(getItemDetail(t.db, priya(), northvale, A.northvaleAd)).rejects.toBeInstanceOf(ForbiddenError);
    // Same client id, foreign item id → not found, never someone else's data.
    await expect(getItemDetail(t.db, priya(), harbourline, A.northvaleAd)).rejects.toThrow(/not found/);
    await expect(getItemDetail(t.db, restrictedTeamAccess([northvale]), northvale, A.northvaleClip)).resolves.toBeTruthy();
  });

  it("item detail exposes staff names to clients but never internal notes", async () => {
    const d = await getItemDetail(t.db, priya(), harbourline, A.harbourlineClip);
    expect(d.comments.some((c) => c.isInternal)).toBe(false);
    expect(d.decisions[0]).toMatchObject({ decision: "changes_requested", userName: "Priya Shah", userIsStaff: false });
    expect(d.approvers).toEqual([]); // contact list is internal-only
    const internal = await getItemDetail(t.db, team(), harbourline, A.harbourlineClip);
    expect(internal.comments.filter((c) => c.isInternal)).toHaveLength(1);
    expect(internal.approvers.map((a) => a.name)).toContain("Priya Shah");
  });
});

describe("client user write limits", () => {
  it("can't create items (app layer and RLS)", async () => {
    await expect(createItem(t.db, priya(), harbourline, { type: "clip", title: "Mine" })).rejects.toBeInstanceOf(ForbiddenError);
    await expectDbError(
      withAccess(t.db, priya(), (tx) =>
        tx.execute(sql`insert into approval_items (client_id, type, title) values (${harbourline}, 'clip', 'x')`)
      ),
      /row-level security/
    );
  });

  it("can't edit anything but status, even on a pending item", async () => {
    await expectDbError(
      withAccess(t.db, priya(), (tx) =>
        tx.execute(sql`update approval_items set title = 'Hacked', status = 'approved' where id = ${A.harbourlineAd}`)
      ),
      /only change approval status/
    );
  });

  it("can't flip an item that isn't pending (RLS) or touch another client's", async () => {
    const res = await withAccess(t.db, priya(), (tx) =>
      tx.execute(sql`update approval_items set status = 'approved' where id in (${A.harbourlineClip}, ${A.escarpmentReel}) returning id`)
    );
    expect(rowsOf(res)).toHaveLength(0);
    await expect(
      decide(t.db, priya(), harbourline, A.harbourlineClip, { decision: "approved" })
    ).rejects.toBeInstanceOf(ApprovalStateError);
  });

  it("comments are always client-visible, whatever the client sends", async () => {
    const { id } = await addComment(t.db, priya(), harbourline, A.harbourlineAd, { body: "Looks great", isInternal: true });
    const d = await getItemDetail(t.db, team(), harbourline, A.harbourlineAd);
    expect(d.comments.find((c) => c.id === id)?.isInternal).toBe(false);
  });

  it("can't read another user's notifications", async () => {
    const all = await withAccess(t.db, priya(), (tx) => tx.execute(sql`select user_id from notifications`));
    expect(rowsOf<{ user_id: string }>(all).every((r) => r.user_id === DEMO_IDS.users.harbourlineClient)).toBe(true);
  });
});

describe("uploads", () => {
  it("rejects keys for another client or item, and files that never arrived", async () => {
    const otherKey = `clients/${northvale}/approvals/${A.northvaleClip}/x/00000000-0000-4000-8000-000000000000.mp4`;
    await expect(
      registerAsset(t.db, team(), escarpment, A.escarpmentReel, { key: otherKey, type: "video/mp4", size: 10 })
    ).rejects.toThrow(ApprovalStateError); // not a draft
    const draft = await createItem(t.db, team(), escarpment, { type: "clip", title: "Upload test" });
    await expect(
      registerAsset(t.db, team(), escarpment, draft.id, { key: otherKey, type: "video/mp4", size: 10 })
    ).rejects.toBeInstanceOf(ForbiddenError);
    const { key } = await createAssetUpload(t.db, team(), escarpment, draft.id, { name: "a.mp4", type: "video/mp4", size: 10 });
    await expect(
      registerAsset(t.db, team(), escarpment, draft.id, { key, type: "video/mp4", size: 10 })
    ).rejects.toThrow(/didn't finish/);
  });

  it("rejects unsupported and oversized files", async () => {
    const draft = await createItem(t.db, team(), escarpment, { type: "meta_ad", title: "Size test" });
    await expect(
      createAssetUpload(t.db, team(), escarpment, draft.id, { name: "a.svg", type: "image/svg+xml", size: 10 })
    ).rejects.toThrow();
    await expect(
      createAssetUpload(t.db, team(), escarpment, draft.id, { name: "a.png", type: "image/png", size: 31 * 1024 * 1024 })
    ).rejects.toThrow(/too large/);
  });
});

describe("review workflow", () => {
  it("draft → send → changes → v2 → send → approved, with history and notifications", async () => {
    // Draft with no file can't be sent.
    const item = await createItem(t.db, team(), harbourline, {
      type: "clip",
      title: "Hygienist day-in-the-life",
      dueAt: "2030-01-15",
    });
    expect(item.status).toBe("draft");
    await expect(sendForApproval(t.db, team(), harbourline, item.id)).rejects.toThrow(/at least one/);
    // Client can't see the draft.
    await expect(getItemDetail(t.db, priya(), harbourline, item.id)).rejects.toThrow(/not found/);

    await upload(team(), harbourline, item.id);
    const before = await unreadCount(t.db, priya());
    const { notified } = await sendForApproval(t.db, team(), harbourline, item.id, { message: "First cut for review." });
    expect(notified).toBe(1); // Priya is Harbourline's only portal user
    expect(await unreadCount(t.db, priya())).toBe(before + 1);

    // Client requests changes; a note is required.
    await expect(
      decide(t.db, priya(), harbourline, item.id, { decision: "changes_requested" })
    ).rejects.toThrow(/what needs to change/);
    await addComment(t.db, priya(), harbourline, item.id, { body: "Music is too loud here", timecodeS: 3.25 });
    const changed = await decide(t.db, priya(), harbourline, item.id, {
      decision: "changes_requested",
      note: "Lower the music.",
    });
    expect(changed.status).toBe("changes_requested");
    const teamInbox = await listNotifications(t.db, team());
    expect(teamInbox[0].title).toMatch(/Priya Shah requested changes/);

    // New version goes back to draft (hidden from client) until sent.
    const v2 = await createVersion(t.db, team(), harbourline, item.id, { notes: "Music down 6 dB." });
    expect(v2.versionNo).toBe(2);
    await expect(getItemDetail(t.db, priya(), harbourline, item.id)).rejects.toThrow(/not found/);
    await expect(sendForApproval(t.db, team(), harbourline, item.id)).rejects.toThrow(/at least one/);
    await upload(team(), harbourline, item.id);
    await sendForApproval(t.db, team(), harbourline, item.id);

    const approved = await decide(t.db, priya(), harbourline, item.id, { decision: "approved" });
    expect(approved.status).toBe("approved");

    const d = await getItemDetail(t.db, priya(), harbourline, item.id);
    expect(d.versions.map((v) => v.versionNo)).toEqual([2, 1]);
    expect(d.current?.versionNo).toBe(2);
    expect(d.decisions.map((x) => [x.versionNo, x.decision])).toEqual([
      [1, "changes_requested"],
      [2, "approved"],
    ]);
    const timecoded = d.comments.find((c) => c.timecodeS !== null && c.body.includes("Music"));
    expect(timecoded).toMatchObject({ timecodeS: 3.25, versionNo: 1, authorIsStaff: false });
    expect(d.comments.find((c) => c.body === "First cut for review.")?.authorIsStaff).toBe(true);
  });

  it("internal staff must say which contact they're recording a decision for", async () => {
    await expect(
      decide(t.db, team(), escarpment, A.escarpmentReel, { decision: "approved" })
    ).rejects.toBeInstanceOf(ForbiddenError);
    const ok = await decide(t.db, team(), escarpment, A.escarpmentReel, {
      decision: "approved",
      onBehalfOf: "Chris Dunn",
      note: "Approved on the phone.",
    });
    expect(ok.status).toBe("approved");
    const d = await getItemDetail(t.db, admin(), escarpment, A.escarpmentReel);
    expect(d.decisions.at(-1)).toMatchObject({ onBehalfOf: "Chris Dunn", userName: "Jordan Lee", userIsStaff: true });
  });

  it("ad copy is required before an ad goes out", async () => {
    const ad = await createItem(t.db, team(), escarpment, { type: "meta_ad", title: "No copy yet" });
    await upload(team(), escarpment, ad.id, "image/png", 512);
    await expect(sendForApproval(t.db, team(), escarpment, ad.id)).rejects.toThrow(/ad copy/);
  });

  it("archive hides an item from the default queue; restore returns it to its last state", async () => {
    await setArchived(t.db, admin(), northvale, A.northvaleAd, true);
    expect((await listQueue(t.db, admin(), { clientId: northvale })).map((r) => r.id)).not.toContain(A.northvaleAd);
    await setArchived(t.db, admin(), northvale, A.northvaleAd, false);
    const d = await getItemDetail(t.db, admin(), northvale, A.northvaleAd);
    expect(d.item.status).toBe("approved");
  });

  it("client users can't manage items", async () => {
    await expect(createVersion(t.db, priya(), harbourline, A.harbourlineClip)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(setArchived(t.db, priya(), harbourline, A.harbourlineClip, true)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(sendForApproval(t.db, priya(), harbourline, A.harbourlineClip)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("email delivery", () => {
  it("sends each pending notification once, to its recipient only", async () => {
    const sent: EmailMessage[] = [];
    const transport: EmailTransport = { name: "test", send: async (m) => void sent.push(m) };
    const first = await deliverPendingEmails(t.db, transport);
    expect(first.sent).toBeGreaterThan(0);
    expect(sent.length).toBe(first.sent);
    // Notifications created above went to Priya (client) and Jordan (staff).
    const to = new Set(sent.map((m) => m.to));
    expect(to.has("priya.shah@demo.harbourline.test")).toBe(true);
    expect(to.has("jordan.lee@demo.boldlyos.test")).toBe(true);
    expect(sent.every((m) => m.html.includes("Boldly") && m.text.length > 0)).toBe(true);
    const again = await deliverPendingEmails(t.db, transport);
    expect(again.sent).toBe(0);
  });

  it("marks failures without losing the notification", async () => {
    await withAccess(t.db, team(), (tx) =>
      tx.execute(sql`insert into notifications (user_id, client_id, actor_id, module, type, title, email_status)
        values (${DEMO_IDS.users.admin}, ${harbourline}, ${DEMO_IDS.users.specialist}, 'approvals', 'x', 'Test', 'pending')`)
    );
    const res = await deliverPendingEmails(t.db, { name: "broken", send: async () => Promise.reject(new Error("smtp down")) });
    expect(res.failed).toBe(1);
    const rows = rowsOf<{ email_status: string; email_error: string }>(
      await t.db.execute(sql`select email_status, email_error from notifications where title = 'Test'`)
    );
    expect(rows[0]).toEqual({ email_status: "failed", email_error: "smtp down" });
  });
});
