// Approvals business logic. Every function: permission check → withAccess()
// (RLS) → state checks → write → activity + notifications. Pages and server
// actions stay thin; tests call these directly.
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { logActivity } from "@/lib/activity";
import { clientContacts, clients, memberships, users } from "@/lib/db/schema";
import { withAccess } from "@/lib/db/scoped";
import type { Db } from "@/lib/db/types";
import { notify } from "@/lib/notifications";
import { assertCan, assertClientAccess, ForbiddenError, type Access } from "@/lib/permissions";
import { getStorage } from "@/lib/storage";
import type { UploadTarget } from "@/lib/storage/types";
import {
  approvalAssets,
  approvalComments,
  approvalDecisions,
  approvalItems,
  approvalVersions,
  type AdCopy,
  type ApprovalAsset,
  type ApprovalItem,
  type ApprovalStatus,
  type ApprovalType,
  type ApprovalVersion,
} from "./schema";
import {
  commentInputSchema,
  decisionInputSchema,
  IMAGE_TYPES,
  itemInputSchema,
  itemUpdateSchema,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  registerAssetSchema,
  STATUS_LABELS,
  TYPE_LABELS,
  uploadRequestSchema,
  versionInputSchema,
  VIDEO_TYPES,
  type CommentInput,
  type DecisionInput,
  type ItemInput,
  type ItemUpdate,
  type RegisterAssetInput,
  type UploadRequest,
  type VersionInput,
} from "./validation";

const MODULE = "approvals";

export class ApprovalStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalStateError";
  }
}

class NotFoundError extends Error {
  constructor(what = "Approval item") {
    super(`${what} not found.`);
    this.name = "NotFoundError";
  }
}

const itemLink = (slug: string, itemId: string) => `/c/${slug}/approvals/${itemId}`;
const displayName = (col: unknown) => sql<string | null>`app.display_name(${col})`;
const isStaff = (col: unknown) => sql<boolean>`app.is_staff(${col})`;

/** Loads an item the caller can see (RLS) and checks it belongs to the given client. */
async function loadItem(tx: Db, clientId: string, itemId: string) {
  const [row] = await tx
    .select({ item: approvalItems, clientSlug: clients.slug, clientName: clients.name })
    .from(approvalItems)
    .innerJoin(clients, eq(clients.id, approvalItems.clientId))
    .where(and(eq(approvalItems.id, itemId), eq(approvalItems.clientId, clientId)));
  if (!row) throw new NotFoundError();
  return row;
}

async function currentVersion(tx: Db, item: ApprovalItem): Promise<ApprovalVersion> {
  if (!item.currentVersionId) throw new ApprovalStateError("This item has no version yet.");
  const [v] = await tx.select().from(approvalVersions).where(eq(approvalVersions.id, item.currentVersionId));
  if (!v) throw new NotFoundError("Version");
  return v;
}

/** Client users (portal accounts) for a client. Internal callers only (memberships RLS). */
async function clientUserIds(tx: Db, clientId: string): Promise<string[]> {
  const rows = await tx
    .select({ id: users.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.clientId, clientId), eq(memberships.role, "client_user"), eq(users.isActive, true)));
  return rows.map((r) => r.id);
}

/** Boldly people attached to an item: creator, version authors and senders. */
async function internalWatcherIds(tx: Db, item: ApprovalItem): Promise<string[]> {
  const versions = await tx
    .select({ createdBy: approvalVersions.createdBy, sentBy: approvalVersions.sentBy })
    .from(approvalVersions)
    .where(eq(approvalVersions.itemId, item.id));
  return [item.createdBy, ...versions.flatMap((v) => [v.createdBy, v.sentBy])].filter((id): id is string => !!id);
}

// ------------------------------------------------------------------ reads

export interface QueueRow {
  id: string;
  clientId: string;
  clientName: string;
  clientSlug: string;
  type: ApprovalType;
  title: string;
  status: ApprovalStatus;
  dueAt: string | null;
  updatedAt: Date;
  versionNo: number | null;
  sentAt: Date | null;
  commentCount: number;
  thumb: { kind: "image" | "video"; url: string } | null;
  assetCount: number;
}

export interface QueueFilter {
  clientId?: string;
  statuses?: ApprovalStatus[];
  type?: ApprovalType;
  limit?: number;
}

/** The approvals queue — one client, or every client the caller can see. */
export async function listQueue(db: Db, access: Access, filter: QueueFilter = {}): Promise<QueueRow[]> {
  assertCan(access, "approvals.view");
  if (filter.clientId) assertClientAccess(access, filter.clientId);

  const rows = await withAccess(db, access, async (tx) => {
    const where: SQL[] = [];
    if (filter.clientId) where.push(eq(approvalItems.clientId, filter.clientId));
    if (filter.statuses?.length) where.push(inArray(approvalItems.status, filter.statuses));
    else where.push(ne(approvalItems.status, "archived"));
    if (filter.type) where.push(eq(approvalItems.type, filter.type));

    const items = await tx
      .select({
        item: approvalItems,
        clientName: clients.name,
        clientSlug: clients.slug,
        versionNo: approvalVersions.versionNo,
        sentAt: approvalVersions.sentAt,
        commentCount: sql<number>`(select count(*)::int from approval_comments c where c.item_id = ${approvalItems.id})`,
      })
      .from(approvalItems)
      .innerJoin(clients, eq(clients.id, approvalItems.clientId))
      .leftJoin(approvalVersions, eq(approvalVersions.id, approvalItems.currentVersionId))
      .where(and(...where))
      .orderBy(
        // Most actionable first: waiting on client, then changes requested, drafts, approved.
        sql`case ${approvalItems.status} when 'pending' then 0 when 'changes_requested' then 1 when 'draft' then 2 when 'approved' then 3 else 4 end`,
        sql`${approvalItems.dueAt} asc nulls last`,
        desc(approvalItems.updatedAt)
      )
      .limit(filter.limit ?? 200);

    const versionIds = items.map((i) => i.item.currentVersionId).filter((v): v is string => !!v);
    const assets = versionIds.length
      ? await tx
          .select()
          .from(approvalAssets)
          .where(inArray(approvalAssets.versionId, versionIds))
          .orderBy(asc(approvalAssets.sortOrder), asc(approvalAssets.createdAt))
      : [];
    return { items, assets };
  });

  const storage = getStorage();
  return Promise.all(
    rows.items.map(async ({ item, clientName, clientSlug, versionNo, sentAt, commentCount }) => {
      const versionAssets = rows.assets.filter((a) => a.versionId === item.currentVersionId);
      const first = versionAssets[0];
      return {
        id: item.id,
        clientId: item.clientId,
        clientName,
        clientSlug,
        type: item.type,
        title: item.title,
        status: item.status,
        dueAt: item.dueAt,
        updatedAt: item.updatedAt,
        versionNo,
        sentAt,
        commentCount,
        assetCount: versionAssets.length,
        thumb: first ? { kind: first.kind, url: await storage.signedUrl(first.storageKey) } : null,
      };
    })
  );
}

export interface AssetView extends ApprovalAsset {
  url: string;
}
export interface VersionView extends ApprovalVersion {
  assets: AssetView[];
  createdByName: string | null;
  sentByName: string | null;
}
export interface CommentView {
  id: string;
  versionId: string;
  versionNo: number;
  body: string;
  timecodeS: number | null;
  isInternal: boolean;
  authorName: string | null;
  authorIsStaff: boolean;
  resolvedAt: Date | null;
  createdAt: Date;
}
export interface DecisionView {
  id: string;
  versionNo: number;
  decision: "approved" | "changes_requested";
  note: string | null;
  onBehalfOf: string | null;
  userName: string | null;
  userIsStaff: boolean;
  createdAt: Date;
}
export interface ItemDetail {
  item: ApprovalItem;
  client: { id: string; name: string; slug: string; website: string | null };
  versions: VersionView[]; // newest first
  current: VersionView | null;
  comments: CommentView[];
  decisions: DecisionView[];
  approvers: { name: string; title: string | null }[]; // internal only, for "on behalf of"
}

export async function getItemDetail(db: Db, access: Access, clientId: string, itemId: string): Promise<ItemDetail> {
  assertCan(access, "approvals.view");
  assertClientAccess(access, clientId);

  const data = await withAccess(db, access, async (tx) => {
    const [row] = await tx
      .select({ item: approvalItems, client: { id: clients.id, name: clients.name, slug: clients.slug, website: clients.website } })
      .from(approvalItems)
      .innerJoin(clients, eq(clients.id, approvalItems.clientId))
      .where(and(eq(approvalItems.id, itemId), eq(approvalItems.clientId, clientId)));
    if (!row) throw new NotFoundError();

    const versions = await tx
      .select({
        v: approvalVersions,
        createdByName: displayName(approvalVersions.createdBy),
        sentByName: displayName(approvalVersions.sentBy),
      })
      .from(approvalVersions)
      .where(eq(approvalVersions.itemId, itemId))
      .orderBy(desc(approvalVersions.versionNo));
    const assets = await tx
      .select()
      .from(approvalAssets)
      .where(eq(approvalAssets.itemId, itemId))
      .orderBy(asc(approvalAssets.sortOrder), asc(approvalAssets.createdAt));
    const comments = await tx
      .select({
        c: approvalComments,
        versionNo: approvalVersions.versionNo,
        authorName: displayName(approvalComments.authorId),
        authorIsStaff: isStaff(approvalComments.authorId),
      })
      .from(approvalComments)
      .innerJoin(approvalVersions, eq(approvalVersions.id, approvalComments.versionId))
      .where(eq(approvalComments.itemId, itemId))
      .orderBy(asc(approvalComments.createdAt));
    const decisions = await tx
      .select({
        d: approvalDecisions,
        versionNo: approvalVersions.versionNo,
        userName: displayName(approvalDecisions.userId),
        userIsStaff: isStaff(approvalDecisions.userId),
      })
      .from(approvalDecisions)
      .innerJoin(approvalVersions, eq(approvalVersions.id, approvalDecisions.versionId))
      .where(eq(approvalDecisions.itemId, itemId))
      .orderBy(asc(approvalDecisions.createdAt));
    const approvers = access.isInternal
      ? await tx
          .select({ name: clientContacts.name, title: clientContacts.title })
          .from(clientContacts)
          .where(and(eq(clientContacts.clientId, clientId), eq(clientContacts.isApprover, true)))
          .orderBy(asc(clientContacts.name))
      : [];
    return { row, versions, assets, comments, decisions, approvers };
  });

  const storage = getStorage();
  const signed = await Promise.all(data.assets.map(async (a) => ({ ...a, url: await storage.signedUrl(a.storageKey) })));
  const versions: VersionView[] = data.versions.map(({ v, createdByName, sentByName }) => ({
    ...v,
    createdByName,
    sentByName,
    assets: signed.filter((a) => a.versionId === v.id),
  }));

  return {
    item: data.row.item,
    client: data.row.client,
    versions,
    current: versions.find((v) => v.id === data.row.item.currentVersionId) ?? null,
    comments: data.comments.map(({ c, versionNo, authorName, authorIsStaff }) => ({
      id: c.id,
      versionId: c.versionId,
      versionNo,
      body: c.body,
      timecodeS: c.timecodeS,
      isInternal: c.isInternal,
      authorName,
      authorIsStaff,
      resolvedAt: c.resolvedAt,
      createdAt: c.createdAt,
    })),
    decisions: data.decisions.map(({ d, versionNo, userName, userIsStaff }) => ({
      id: d.id,
      versionNo,
      decision: d.decision,
      note: d.note,
      onBehalfOf: d.onBehalfOf,
      userName,
      userIsStaff,
      createdAt: d.createdAt,
    })),
    approvers: data.approvers,
  };
}

/** Counts per status for the queue tabs. */
export async function queueCounts(db: Db, access: Access, clientId?: string): Promise<Record<ApprovalStatus, number>> {
  assertCan(access, "approvals.view");
  if (clientId) assertClientAccess(access, clientId);
  const rows = await withAccess(db, access, (tx) =>
    tx
      .select({ status: approvalItems.status, n: sql<number>`count(*)::int` })
      .from(approvalItems)
      .where(clientId ? eq(approvalItems.clientId, clientId) : undefined)
      .groupBy(approvalItems.status)
  );
  const out = { draft: 0, pending: 0, changes_requested: 0, approved: 0, archived: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}

// ---------------------------------------------------------------- writes

export async function createItem(db: Db, access: Access, clientId: string, input: ItemInput): Promise<ApprovalItem> {
  assertCan(access, "approvals.manage");
  assertClientAccess(access, clientId);
  const data = itemInputSchema.parse(input);

  return withAccess(db, access, async (tx) => {
    const [item] = await tx
      .insert(approvalItems)
      .values({
        clientId,
        type: data.type,
        title: data.title,
        description: data.description ?? null,
        dueAt: data.dueAt ?? null,
        sourceRef: data.sourceRef ?? null,
        createdBy: access.userId,
      })
      .returning();
    const [version] = await tx
      .insert(approvalVersions)
      .values({
        itemId: item.id,
        clientId,
        versionNo: 1,
        copy: data.type === "meta_ad" ? (data.copy ?? {}) : {},
        createdBy: access.userId,
      })
      .returning();
    const [withVersion] = await tx
      .update(approvalItems)
      .set({ currentVersionId: version.id })
      .where(eq(approvalItems.id, item.id))
      .returning();
    await logActivity(tx, access, {
      clientId,
      module: MODULE,
      action: "item.created",
      entityType: "approval_item",
      entityId: item.id,
      summary: `Created ${TYPE_LABELS[item.type]} “${item.title}”`,
    });
    return withVersion;
  });
}

export async function updateItem(
  db: Db,
  access: Access,
  clientId: string,
  itemId: string,
  input: ItemUpdate
): Promise<ApprovalItem> {
  assertCan(access, "approvals.manage");
  assertClientAccess(access, clientId);
  const data = itemUpdateSchema.parse(input);

  return withAccess(db, access, async (tx) => {
    const { item } = await loadItem(tx, clientId, itemId);
    if (item.status === "archived") throw new ApprovalStateError("Restore this item before editing it.");
    const [updated] = await tx
      .update(approvalItems)
      .set({
        title: data.title,
        description: data.description ?? null,
        dueAt: data.dueAt ?? null,
        sourceRef: data.sourceRef ?? null,
      })
      .where(eq(approvalItems.id, itemId))
      .returning();
    // Ad copy lives on the version; only the draft version is editable.
    if (data.copy && item.type === "meta_ad" && item.status === "draft" && item.currentVersionId) {
      await tx.update(approvalVersions).set({ copy: data.copy }).where(eq(approvalVersions.id, item.currentVersionId));
    }
    await logActivity(tx, access, {
      clientId,
      module: MODULE,
      action: "item.updated",
      entityType: "approval_item",
      entityId: itemId,
      summary: `Updated “${updated.title}”`,
    });
    return updated;
  });
}

function assetKind(mime: string): "image" | "video" {
  if (mime in IMAGE_TYPES) return "image";
  if (mime in VIDEO_TYPES) return "video";
  throw new ApprovalStateError("Unsupported file type.");
}

/** Issues a direct-to-storage upload URL for the item's current (draft) version. */
export async function createAssetUpload(
  db: Db,
  access: Access,
  clientId: string,
  itemId: string,
  input: UploadRequest
): Promise<{ key: string; target: UploadTarget }> {
  assertCan(access, "approvals.manage");
  assertClientAccess(access, clientId);
  const file = uploadRequestSchema.parse(input);
  const kind = assetKind(file.type);
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > max) throw new ApprovalStateError(`That file is too large (max ${Math.round(max / 1024 / 1024)} MB).`);

  const versionId = await withAccess(db, access, async (tx) => {
    const { item } = await loadItem(tx, clientId, itemId);
    if (item.status !== "draft") throw new ApprovalStateError("Files can only be added to a draft version.");
    return (await currentVersion(tx, item)).id;
  });

  const ext = (IMAGE_TYPES[file.type] ?? VIDEO_TYPES[file.type])!;
  const key = `clients/${clientId}/approvals/${itemId}/${versionId}/${randomUUID()}.${ext}`;
  return { key, target: await getStorage().createUploadTarget(key, file.type, max) };
}

/** Records an uploaded file against the current draft version, after verifying it landed in storage. */
export async function registerAsset(
  db: Db,
  access: Access,
  clientId: string,
  itemId: string,
  input: RegisterAssetInput
): Promise<ApprovalAsset> {
  assertCan(access, "approvals.manage");
  assertClientAccess(access, clientId);
  const data = registerAssetSchema.parse(input);
  const kind = assetKind(data.type);

  return withAccess(db, access, async (tx) => {
    const { item } = await loadItem(tx, clientId, itemId);
    if (item.status !== "draft") throw new ApprovalStateError("Files can only be added to a draft version.");
    const version = await currentVersion(tx, item);

    // The key must be one we issued for exactly this client/item/version.
    const prefix = `clients/${clientId}/approvals/${itemId}/${version.id}/`;
    const expectedExt = IMAGE_TYPES[data.type] ?? VIDEO_TYPES[data.type];
    if (!data.key.startsWith(prefix) || !/^[0-9a-f-]{36}\.[a-z0-9]+$/.test(data.key.slice(prefix.length)) || !data.key.endsWith(`.${expectedExt}`)) {
      throw new ForbiddenError("That upload doesn't belong to this item.");
    }
    const stored = await getStorage().stat(data.key);
    if (!stored) throw new ApprovalStateError("The upload didn't finish. Try again.");

    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(approvalAssets)
      .where(eq(approvalAssets.versionId, version.id));
    const [asset] = await tx
      .insert(approvalAssets)
      .values({
        versionId: version.id,
        itemId,
        clientId,
        kind,
        storageKey: data.key,
        mimeType: data.type,
        sizeBytes: stored.size,
        originalName: data.name ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        durationS: data.durationS ?? null,
        sortOrder: n,
        createdBy: access.userId,
      })
      .returning();
    await tx.update(approvalItems).set({ updatedAt: new Date() }).where(eq(approvalItems.id, itemId));
    return asset;
  });
}

export async function removeAsset(db: Db, access: Access, clientId: string, itemId: string, assetId: string) {
  assertCan(access, "approvals.manage");
  assertClientAccess(access, clientId);
  const key = await withAccess(db, access, async (tx) => {
    const { item } = await loadItem(tx, clientId, itemId);
    if (item.status !== "draft") throw new ApprovalStateError("Files can only be removed from a draft version.");
    const [removed] = await tx
      .delete(approvalAssets)
      .where(
        and(
          eq(approvalAssets.id, assetId),
          eq(approvalAssets.itemId, itemId),
          eq(approvalAssets.versionId, item.currentVersionId!)
        )
      )
      .returning();
    if (!removed) throw new NotFoundError("File");
    return removed.storageKey;
  });
  await getStorage().remove([key]).catch((e) => console.error("Storage delete failed", e));
}

export async function sendForApproval(
  db: Db,
  access: Access,
  clientId: string,
  itemId: string,
  opts: { message?: string | null } = {}
): Promise<{ notified: number }> {
  assertCan(access, "approvals.manage");
  assertClientAccess(access, clientId);

  return withAccess(db, access, async (tx) => {
    const { item, clientSlug } = await loadItem(tx, clientId, itemId);
    if (item.status !== "draft") throw new ApprovalStateError("Only drafts can be sent for approval.");
    const version = await currentVersion(tx, item);
    const assets = await tx.select().from(approvalAssets).where(eq(approvalAssets.versionId, version.id));
    if (assets.length === 0) throw new ApprovalStateError("Add at least one image or video first.");
    if (item.type === "clip" && !assets.some((a) => a.kind === "video")) {
      throw new ApprovalStateError("A clip needs a video file.");
    }
    if (item.type === "meta_ad" && !version.copy.primaryText && !version.copy.headline) {
      throw new ApprovalStateError("Add the ad copy (primary text or headline) before sending.");
    }

    const now = new Date();
    await tx.update(approvalVersions).set({ sentAt: now, sentBy: access.userId }).where(eq(approvalVersions.id, version.id));
    await tx
      .update(approvalItems)
      .set({ status: "pending", decidedAt: null })
      .where(eq(approvalItems.id, itemId));

    const message = opts.message?.trim();
    if (message) {
      await tx.insert(approvalComments).values({
        itemId,
        versionId: version.id,
        clientId,
        authorId: access.userId,
        body: message.slice(0, 5000),
      });
    }

    const notified = await notify(tx, access, {
      recipients: await clientUserIds(tx, clientId),
      clientId,
      module: MODULE,
      type: "approval.requested",
      title: `Ready for your review: ${item.title}`,
      body: [
        `${TYPE_LABELS[item.type]} · version ${version.versionNo}${item.dueAt ? ` · needed by ${item.dueAt}` : ""}`,
        message,
      ]
        .filter(Boolean)
        .join("\n\n"),
      link: itemLink(clientSlug, itemId),
      entityType: "approval_item",
      entityId: itemId,
    });

    await logActivity(tx, access, {
      clientId,
      module: MODULE,
      action: "item.sent",
      entityType: "approval_item",
      entityId: itemId,
      summary: `Sent “${item.title}” (v${version.versionNo}) for client approval`,
      metadata: { versionNo: version.versionNo, notified },
    });
    return { notified };
  });
}

export async function decide(
  db: Db,
  access: Access,
  clientId: string,
  itemId: string,
  input: DecisionInput
): Promise<ApprovalItem> {
  assertCan(access, "approvals.decide");
  assertClientAccess(access, clientId);
  const data = decisionInputSchema.parse(input);
  if (access.isInternal && !data.onBehalfOf) {
    throw new ForbiddenError("Choose which client contact this decision is from.");
  }
  const onBehalfOf = access.isInternal ? data.onBehalfOf! : null;

  return withAccess(db, access, async (tx) => {
    const { item, clientSlug } = await loadItem(tx, clientId, itemId);
    if (item.status !== "pending") throw new ApprovalStateError("This item isn't waiting for a decision.");
    const version = await currentVersion(tx, item);

    await tx.insert(approvalDecisions).values({
      itemId,
      versionId: version.id,
      clientId,
      userId: access.userId,
      decision: data.decision,
      note: data.note ?? null,
      onBehalfOf,
    });
    const [updated] = await tx
      .update(approvalItems)
      .set({ status: data.decision, decidedAt: new Date() })
      .where(eq(approvalItems.id, itemId))
      .returning();

    const who = onBehalfOf ?? access.name ?? access.email;
    const verb = data.decision === "approved" ? "approved" : "requested changes to";
    await notify(tx, access, {
      recipients: await internalWatcherIds(tx, item),
      clientId,
      module: MODULE,
      type: `approval.${data.decision}`,
      title: `${who} ${verb} “${item.title}”`,
      body: data.note ?? null,
      link: itemLink(clientSlug, itemId),
      entityType: "approval_item",
      entityId: itemId,
    });
    await logActivity(tx, access, {
      clientId,
      module: MODULE,
      action: `item.${data.decision}`,
      entityType: "approval_item",
      entityId: itemId,
      summary: onBehalfOf
        ? `Recorded ${onBehalfOf}’s decision: ${data.decision === "approved" ? "approved" : "changes requested"} — “${item.title}” (v${version.versionNo})`
        : `${data.decision === "approved" ? "Approved" : "Requested changes to"} “${item.title}” (v${version.versionNo})`,
      metadata: { versionNo: version.versionNo, onBehalfOf },
    });
    return updated;
  });
}

/** Starts a new draft version (after changes were requested, or to revise). Copies ad copy forward. */
export async function createVersion(
  db: Db,
  access: Access,
  clientId: string,
  itemId: string,
  input: VersionInput = {}
): Promise<ApprovalVersion> {
  assertCan(access, "approvals.manage");
  assertClientAccess(access, clientId);
  const data = versionInputSchema.parse(input);

  return withAccess(db, access, async (tx) => {
    const { item } = await loadItem(tx, clientId, itemId);
    if (item.status === "draft") throw new ApprovalStateError("The current version is still a draft — edit it instead.");
    if (item.status === "archived") throw new ApprovalStateError("Restore this item first.");
    const prev = await currentVersion(tx, item);
    const [version] = await tx
      .insert(approvalVersions)
      .values({
        itemId,
        clientId,
        versionNo: prev.versionNo + 1,
        notes: data.notes ?? null,
        copy: item.type === "meta_ad" ? ((data.copy ?? prev.copy) as AdCopy) : {},
        createdBy: access.userId,
      })
      .returning();
    await tx
      .update(approvalItems)
      .set({ currentVersionId: version.id, status: "draft", decidedAt: null })
      .where(eq(approvalItems.id, itemId));
    await logActivity(tx, access, {
      clientId,
      module: MODULE,
      action: "version.created",
      entityType: "approval_item",
      entityId: itemId,
      summary: `Started version ${version.versionNo} of “${item.title}”`,
    });
    return version;
  });
}

export async function addComment(
  db: Db,
  access: Access,
  clientId: string,
  itemId: string,
  input: CommentInput
): Promise<{ id: string }> {
  assertCan(access, "approvals.view");
  assertClientAccess(access, clientId);
  const data = commentInputSchema.parse(input);
  const isInternal = access.isInternal ? data.isInternal : false;

  return withAccess(db, access, async (tx) => {
    const { item, clientSlug } = await loadItem(tx, clientId, itemId);
    if (item.status === "archived") throw new ApprovalStateError("This item is archived.");
    let versionId = item.currentVersionId!;
    if (data.versionId && data.versionId !== versionId) {
      const [v] = await tx
        .select({ id: approvalVersions.id })
        .from(approvalVersions)
        .where(and(eq(approvalVersions.id, data.versionId), eq(approvalVersions.itemId, itemId)));
      if (!v) throw new NotFoundError("Version");
      versionId = v.id;
    }
    const [comment] = await tx
      .insert(approvalComments)
      .values({
        itemId,
        versionId,
        clientId,
        authorId: access.userId,
        body: data.body,
        timecodeS: data.timecodeS ?? null,
        isInternal,
      })
      .returning({ id: approvalComments.id });

    const who = access.name ?? access.email;
    const recipients = !access.isInternal
      ? await internalWatcherIds(tx, item)
      : isInternal
        ? (await internalWatcherIds(tx, item))
        : [...(item.status !== "draft" ? await clientUserIds(tx, clientId) : []), ...(await internalWatcherIds(tx, item))];
    await notify(tx, access, {
      recipients,
      clientId,
      module: MODULE,
      type: "approval.comment",
      title: `${who} commented on “${item.title}”`,
      body: data.body.length > 280 ? `${data.body.slice(0, 277)}…` : data.body,
      link: `${itemLink(clientSlug, itemId)}#comment-${comment.id}`,
      entityType: "approval_item",
      entityId: itemId,
      email: !isInternal,
    });
    return comment;
  });
}

export async function setCommentResolved(
  db: Db,
  access: Access,
  clientId: string,
  itemId: string,
  commentId: string,
  resolved: boolean
) {
  assertCan(access, "approvals.manage");
  assertClientAccess(access, clientId);
  await withAccess(db, access, async (tx) => {
    const updated = await tx
      .update(approvalComments)
      .set(resolved ? { resolvedAt: new Date(), resolvedBy: access.userId } : { resolvedAt: null, resolvedBy: null })
      .where(and(eq(approvalComments.id, commentId), eq(approvalComments.itemId, itemId), eq(approvalComments.clientId, clientId)))
      .returning({ id: approvalComments.id });
    if (updated.length === 0) throw new NotFoundError("Comment");
  });
}

export async function setArchived(db: Db, access: Access, clientId: string, itemId: string, archived: boolean) {
  assertCan(access, "approvals.manage");
  assertClientAccess(access, clientId);
  await withAccess(db, access, async (tx) => {
    const { item } = await loadItem(tx, clientId, itemId);
    if (archived === (item.status === "archived")) return;
    // Restoring lands on the state implied by the latest decision (or draft).
    let status: ApprovalStatus = "archived";
    if (!archived) {
      const [last] = await tx
        .select({ decision: approvalDecisions.decision })
        .from(approvalDecisions)
        .where(and(eq(approvalDecisions.itemId, itemId), eq(approvalDecisions.versionId, item.currentVersionId!)))
        .orderBy(desc(approvalDecisions.createdAt))
        .limit(1);
      const [v] = await tx
        .select({ sentAt: approvalVersions.sentAt })
        .from(approvalVersions)
        .where(eq(approvalVersions.id, item.currentVersionId!));
      status = last?.decision ?? (v?.sentAt ? "pending" : "draft");
    }
    await tx.update(approvalItems).set({ status }).where(eq(approvalItems.id, itemId));
    await logActivity(tx, access, {
      clientId,
      module: MODULE,
      action: archived ? "item.archived" : "item.restored",
      entityType: "approval_item",
      entityId: itemId,
      summary: `${archived ? "Archived" : "Restored"} “${item.title}”${archived ? "" : ` (${STATUS_LABELS[status].toLowerCase()})`}`,
    });
  });
}
