// Demo approvals for the 3 seeded clients, with real sample media pushed to
// the configured storage driver. Uses the owner connection (bypasses RLS).
import { readFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { activityLog, notifications } from "@/lib/db/schema";
import { rowsOf, type Db } from "@/lib/db/types";
import type { StorageDriver } from "@/lib/storage/types";
import {
  approvalAssets,
  approvalComments,
  approvalDecisions,
  approvalItems,
  approvalVersions,
  type AdCopy,
  type ApprovalStatus,
  type ApprovalType,
} from "@/modules/approvals/schema";
import { DEMO_IDS } from "./data";

const MEDIA_DIR = path.join(process.cwd(), "db", "seed", "media");
const C = DEMO_IDS.clients;
const U = DEMO_IDS.users;

const H = 3600_000;
const D = 24 * H;
const ago = (ms: number) => new Date(Date.now() - ms);
const dayOffset = (days: number) => new Date(Date.now() + days * D).toISOString().slice(0, 10);

interface SeedAsset {
  file: string;
  width: number;
  height: number;
  durationS?: number;
}
interface SeedComment {
  by: keyof typeof U;
  at: number; // ms ago
  body: string;
  timecodeS?: number;
  internal?: boolean;
}
interface SeedDecision {
  by: keyof typeof U;
  at: number;
  decision: "approved" | "changes_requested";
  note?: string;
  onBehalfOf?: string;
}
interface SeedVersion {
  createdAt: number;
  by: keyof typeof U;
  sentAt?: number;
  notes?: string;
  copy?: AdCopy;
  assets: SeedAsset[];
  comments?: SeedComment[];
  decisions?: SeedDecision[];
}
interface SeedItem {
  id: string;
  clientId: string;
  type: ApprovalType;
  title: string;
  description?: string;
  status: ApprovalStatus;
  dueInDays?: number;
  sourceRef?: string;
  by: keyof typeof U;
  versions: SeedVersion[];
}

const img = (file: string): SeedAsset => ({ file, width: 1080, height: 1080 });
const vid = (file: string, durationS: number): SeedAsset => ({ file, width: 540, height: 960, durationS });

export const DEMO_APPROVAL_IDS = {
  harbourlineAd: "30000000-0000-4000-8000-000000000001",
  harbourlineClip: "30000000-0000-4000-8000-000000000002",
  northvaleAd: "30000000-0000-4000-8000-000000000003",
  northvaleClip: "30000000-0000-4000-8000-000000000004",
  escarpmentReel: "30000000-0000-4000-8000-000000000005",
  escarpmentCarousel: "30000000-0000-4000-8000-000000000006",
} as const;

const ITEMS: SeedItem[] = [
  {
    id: DEMO_APPROVAL_IDS.harbourlineAd,
    clientId: C.harbourline,
    type: "meta_ad",
    title: "Spring new-patient offer — feed ad",
    description: "Prospecting, 25 km around the three clinics. Runs Mar 3 – Apr 14.",
    status: "pending",
    dueInDays: 3,
    sourceRef: "Ad set: NP Spring · Prospecting",
    by: "specialist",
    versions: [
      {
        createdAt: 2 * D,
        by: "specialist",
        sentAt: 1 * D,
        copy: {
          primaryText:
            "New to Harbourline? Book your first cleaning this spring and take home a professional whitening kit on us. Three Hamilton clinics, evening appointments available.",
          headline: "Your smile, seen this spring",
          description: "Free whitening kit with first cleaning",
          cta: "Book now",
          url: "https://harbourline-dental.example/new-patients",
        },
        assets: [img("harbourline-spring-offer.jpg")],
        comments: [{ by: "specialist", at: 1 * D, body: "Here's the spring prospecting ad. Copy follows the offer terms you sent on the 12th." }],
      },
    ],
  },
  {
    id: DEMO_APPROVAL_IDS.harbourlineClip,
    clientId: C.harbourline,
    type: "clip",
    title: "Dr. Bell — 3 signs you’re overdue for a cleaning",
    description: "Reel cut from the February podcast episode.",
    status: "changes_requested",
    dueInDays: 5,
    sourceRef: "Riverside: Harbourline Ep. 4 · magic clip #2",
    by: "specialist",
    versions: [
      {
        createdAt: 5 * D,
        by: "specialist",
        sentAt: 4 * D,
        assets: [vid("harbourline-cleaning-clip.mp4", 12)],
        comments: [
          { by: "harbourlineClient", at: 2 * D + 2 * H, body: "Can we trim the intro? It takes a while to get to the first sign.", timecodeS: 2.5 },
          { by: "harbourlineClient", at: 2 * D + H, body: "Love this part — keep it.", timecodeS: 7 },
          { by: "specialist", at: 1 * D, body: "Re-cut in progress; adding burned-in captions too.", internal: true },
        ],
        decisions: [
          { by: "harbourlineClient", at: 2 * D, decision: "changes_requested", note: "Shorten the intro and add captions, please." },
        ],
      },
    ],
  },
  {
    id: DEMO_APPROVAL_IDS.northvaleAd,
    clientId: C.northvale,
    type: "meta_ad",
    title: "First-home mortgage webinar — registration ad",
    status: "approved",
    dueInDays: -2,
    sourceRef: "Campaign: Mortgages · Webinar Q1",
    by: "specialist",
    versions: [
      {
        createdAt: 9 * D,
        by: "specialist",
        sentAt: 8 * D,
        copy: {
          primaryText: "Buying your first home? Join Northvale's free webinar and get your questions answered by our mortgage team.",
          headline: "Your first home, without the guesswork",
          cta: "Register",
          url: "https://northvale-cu.example/webinar",
        },
        assets: [img("northvale-webinar-v1.jpg")],
        decisions: [
          {
            by: "specialist",
            at: 7 * D,
            decision: "changes_requested",
            note: "Compliance: any rate shown needs the APR disclaimer in the copy.",
            onBehalfOf: "Sam Okafor",
          },
        ],
      },
      {
        createdAt: 6 * D,
        by: "specialist",
        sentAt: 6 * D - 2 * H,
        notes: "Added APR and the disclaimer line per compliance.",
        copy: {
          primaryText:
            "Buying your first home? Join Northvale's free webinar and get your questions answered by our mortgage team. *Rates from 4.89% APR, OAC. Rates subject to change.",
          headline: "Your first home, without the guesswork",
          cta: "Register",
          url: "https://northvale-cu.example/webinar",
        },
        assets: [img("northvale-webinar-v2.jpg")],
        decisions: [{ by: "admin", at: 5 * D, decision: "approved", note: "Approved by email.", onBehalfOf: "Elena Fischer" }],
      },
    ],
  },
  {
    id: DEMO_APPROVAL_IDS.northvaleClip,
    clientId: C.northvale,
    type: "clip",
    title: "Member story: the Patels",
    status: "draft",
    dueInDays: 9,
    sourceRef: "Riverside: Member Stories · Patel family",
    by: "specialist",
    versions: [
      {
        createdAt: 3 * H,
        by: "specialist",
        assets: [vid("northvale-member-story.mp4", 10)],
        comments: [{ by: "admin", at: 2 * H, body: "Check the lower third spells the branch name right before sending.", internal: true }],
      },
    ],
  },
  {
    id: DEMO_APPROVAL_IDS.escarpmentReel,
    clientId: C.escarpment,
    type: "clip",
    title: "Taproom tour reel",
    status: "pending",
    dueInDays: 1,
    by: "specialist",
    versions: [{ createdAt: 6 * H, by: "specialist", sentAt: 4 * H, assets: [vid("escarpment-taproom-reel.mp4", 9)] }],
  },
  {
    id: DEMO_APPROVAL_IDS.escarpmentCarousel,
    clientId: C.escarpment,
    type: "meta_ad",
    title: "Harvest Ale launch — carousel",
    description: "3-card carousel for the launch weekend.",
    status: "pending",
    dueInDays: -1,
    by: "admin",
    versions: [
      {
        createdAt: 4 * D,
        by: "admin",
        sentAt: 3 * D,
        copy: {
          primaryText: "Harvest Ale is back for a limited run. Grab a pint at the taproom or a four-pack to go.",
          headline: "Harvest Ale is back",
          description: "Limited release · 6.2% ABV",
          cta: "Learn more",
          url: "https://escarpment-brewing.example/harvest",
        },
        assets: [img("escarpment-harvest-1.jpg"), img("escarpment-harvest-2.jpg"), img("escarpment-harvest-3.jpg")],
      },
    ],
  },
];

/** Deterministic version ids: 4…<item#><version#>, e.g. item …0001 v2 → 40000000-…-000000000102. */
const versionId = (itemId: string, n: number) =>
  `4${itemId.slice(1, -4)}${itemId.slice(-2)}${String(n).padStart(2, "0")}`;

export async function seedApprovals(db: Db, storage: StorageDriver): Promise<{ inserted: boolean }> {
  const existing = rowsOf(await db.execute(sql`select 1 from approval_items where id = ${DEMO_APPROVAL_IDS.harbourlineAd}`));
  if (existing.length > 0) return { inserted: false };

  // Upload media first (outside the transaction).
  const uploaded = new Map<string, string>();
  for (const item of ITEMS) {
    for (const [vi, v] of item.versions.entries()) {
      for (const a of v.assets) {
        const vid = versionId(item.id, vi + 1);
        const ext = path.extname(a.file).slice(1);
        const key = `clients/${item.clientId}/approvals/${item.id}/${vid}/${a.file.replace(/\.[^.]+$/, "")}.${ext}`;
        await storage.put(key, readFileSync(path.join(MEDIA_DIR, a.file)), ext === "mp4" ? "video/mp4" : "image/jpeg");
        uploaded.set(`${vid}:${a.file}`, key);
      }
    }
  }

  await db.transaction(async (tx) => {
    for (const item of ITEMS) {
      const first = item.versions[0];
      await tx.insert(approvalItems).values({
        id: item.id,
        clientId: item.clientId,
        type: item.type,
        title: item.title,
        description: item.description ?? null,
        status: item.status,
        dueAt: item.dueInDays !== undefined ? dayOffset(item.dueInDays) : null,
        sourceRef: item.sourceRef ?? null,
        createdBy: U[item.by],
        createdAt: ago(first.createdAt),
      });
      let lastDecisionAt: number | undefined;
      for (const [vi, v] of item.versions.entries()) {
        const vid = versionId(item.id, vi + 1);
        await tx.insert(approvalVersions).values({
          id: vid,
          itemId: item.id,
          clientId: item.clientId,
          versionNo: vi + 1,
          notes: v.notes ?? null,
          copy: v.copy ?? {},
          createdBy: U[v.by],
          sentAt: v.sentAt !== undefined ? ago(v.sentAt) : null,
          sentBy: v.sentAt !== undefined ? U[v.by] : null,
          createdAt: ago(v.createdAt),
        });
        await tx.insert(approvalAssets).values(
          v.assets.map((a, i) => ({
            versionId: vid,
            itemId: item.id,
            clientId: item.clientId,
            kind: a.durationS ? ("video" as const) : ("image" as const),
            storageKey: uploaded.get(`${vid}:${a.file}`)!,
            mimeType: a.durationS ? "video/mp4" : "image/jpeg",
            sizeBytes: readFileSync(path.join(MEDIA_DIR, a.file)).byteLength,
            originalName: a.file,
            width: a.width,
            height: a.height,
            durationS: a.durationS ?? null,
            sortOrder: i,
            createdBy: U[v.by],
            createdAt: ago(v.createdAt),
          }))
        );
        for (const c of v.comments ?? []) {
          await tx.insert(approvalComments).values({
            itemId: item.id,
            versionId: vid,
            clientId: item.clientId,
            authorId: U[c.by],
            body: c.body,
            timecodeS: c.timecodeS ?? null,
            isInternal: c.internal ?? false,
            createdAt: ago(c.at),
          });
        }
        for (const d of v.decisions ?? []) {
          await tx.insert(approvalDecisions).values({
            itemId: item.id,
            versionId: vid,
            clientId: item.clientId,
            userId: U[d.by],
            decision: d.decision,
            note: d.note ?? null,
            onBehalfOf: d.onBehalfOf ?? null,
            createdAt: ago(d.at),
          });
          lastDecisionAt = d.at;
        }
      }
      await tx.execute(sql`
        update approval_items
        set current_version_id = ${versionId(item.id, item.versions.length)},
            decided_at = ${lastDecisionAt !== undefined && ["approved", "changes_requested"].includes(item.status) ? ago(lastDecisionAt) : null}
        where id = ${item.id}`);
    }

    // A couple of activity entries and notifications so the bell isn't empty.
    await tx.insert(activityLog).values([
      { clientId: C.harbourline, actorId: U.specialist, module: "approvals", action: "item.sent", entityType: "approval_item", entityId: DEMO_APPROVAL_IDS.harbourlineAd, summary: "Sent “Spring new-patient offer — feed ad” (v1) for client approval", createdAt: ago(1 * D) },
      { clientId: C.harbourline, actorId: U.harbourlineClient, module: "approvals", action: "item.changes_requested", entityType: "approval_item", entityId: DEMO_APPROVAL_IDS.harbourlineClip, summary: "Requested changes to “Dr. Bell — 3 signs you’re overdue for a cleaning” (v1)", createdAt: ago(2 * D) },
      { clientId: C.northvale, actorId: U.admin, module: "approvals", action: "item.approved", entityType: "approval_item", entityId: DEMO_APPROVAL_IDS.northvaleAd, summary: "Recorded Elena Fischer’s decision: approved — “First-home mortgage webinar — registration ad” (v2)", createdAt: ago(5 * D) },
      { clientId: C.escarpment, actorId: U.specialist, module: "approvals", action: "item.sent", entityType: "approval_item", entityId: DEMO_APPROVAL_IDS.escarpmentReel, summary: "Sent “Taproom tour reel” (v1) for client approval", createdAt: ago(4 * H) },
    ]);
    await tx.insert(notifications).values([
      { userId: U.specialist, clientId: C.harbourline, actorId: U.harbourlineClient, module: "approvals", type: "approval.changes_requested", title: "Priya Shah requested changes to “Dr. Bell — 3 signs you’re overdue for a cleaning”", body: "Shorten the intro and add captions, please.", link: `/c/harbourline-dental/approvals/${DEMO_APPROVAL_IDS.harbourlineClip}`, entityType: "approval_item", entityId: DEMO_APPROVAL_IDS.harbourlineClip, createdAt: ago(2 * D) },
      { userId: U.harbourlineClient, clientId: C.harbourline, actorId: U.specialist, module: "approvals", type: "approval.requested", title: "Ready for your review: Spring new-patient offer — feed ad", body: "Meta ad · version 1", link: `/c/harbourline-dental/approvals/${DEMO_APPROVAL_IDS.harbourlineAd}`, entityType: "approval_item", entityId: DEMO_APPROVAL_IDS.harbourlineAd, createdAt: ago(1 * D) },
    ]);
  });
  return { inserted: true };
}
