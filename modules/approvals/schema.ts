// Drizzle mirror of db/migrations/0004_approvals.sql (the source of truth).
import { date, integer, jsonb, numeric, pgTable, text, timestamp, uuid, bigint, boolean } from "drizzle-orm/pg-core";
import { clients, users } from "@/lib/db/schema";

export const APPROVAL_TYPES = ["meta_ad", "clip"] as const;
export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const APPROVAL_STATUSES = ["draft", "pending", "changes_requested", "approved", "archived"] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const DECISIONS = ["approved", "changes_requested"] as const;
export type Decision = (typeof DECISIONS)[number];

export interface AdCopy {
  primaryText?: string;
  headline?: string;
  description?: string;
  cta?: string;
  url?: string;
}

const ts = (name: string) => timestamp(name, { withTimezone: true });

export const approvalItems = pgTable("approval_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  type: text("type").$type<ApprovalType>().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").$type<ApprovalStatus>().notNull().default("draft"),
  dueAt: date("due_at"),
  sourceRef: text("source_ref"),
  currentVersionId: uuid("current_version_id"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  decidedAt: ts("decided_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const approvalVersions = pgTable("approval_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => approvalItems.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull(),
  notes: text("notes"),
  copy: jsonb("copy").$type<AdCopy>().notNull().default({}),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  sentAt: ts("sent_at"),
  sentBy: uuid("sent_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const approvalAssets = pgTable("approval_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionId: uuid("version_id").notNull().references(() => approvalVersions.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").notNull().references(() => approvalItems.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  kind: text("kind").$type<"image" | "video">().notNull(),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
  originalName: text("original_name"),
  width: integer("width"),
  height: integer("height"),
  durationS: numeric("duration_s", { precision: 10, scale: 3, mode: "number" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const approvalComments = pgTable("approval_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => approvalItems.id, { onDelete: "cascade" }),
  versionId: uuid("version_id").notNull().references(() => approvalVersions.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  timecodeS: numeric("timecode_s", { precision: 10, scale: 3, mode: "number" }),
  isInternal: boolean("is_internal").notNull().default(false),
  resolvedAt: ts("resolved_at"),
  resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const approvalDecisions = pgTable("approval_decisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").notNull().references(() => approvalItems.id, { onDelete: "cascade" }),
  versionId: uuid("version_id").notNull().references(() => approvalVersions.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  decision: text("decision").$type<Decision>().notNull(),
  note: text("note"),
  onBehalfOf: text("on_behalf_of"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export type ApprovalItem = typeof approvalItems.$inferSelect;
export type ApprovalVersion = typeof approvalVersions.$inferSelect;
export type ApprovalAsset = typeof approvalAssets.$inferSelect;
export type ApprovalComment = typeof approvalComments.$inferSelect;
export type ApprovalDecision = typeof approvalDecisions.$inferSelect;
