// Drizzle table definitions. These mirror db/migrations/*.sql, which is the
// source of truth for the database (constraints, RLS, grants live there).
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  authUserId: uuid("auth_user_id"),
  email: text("email").notNull(),
  name: text("name"),
  title: text("title"),
  avatarUrl: text("avatar_url"),
  isActive: boolean("is_active").notNull().default(true),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  ...timestamps,
});

export const CLIENT_STATUSES = ["prospect", "active", "paused", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  website: text("website"),
  industry: text("industry"),
  city: text("city"),
  status: text("status").$type<ClientStatus>().notNull().default("active"),
  services: text("services").array().notNull().default([]),
  timezone: text("timezone").notNull().default("America/Toronto"),
  currency: text("currency").notNull().default("CAD"),
  notes: text("notes"),
  crmRef: text("crm_ref"),
  ...timestamps,
});

export const ROLES = ["admin", "team", "client_user"] as const;
export type Role = (typeof ROLES)[number];

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  role: text("role").$type<Role>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const CHANNELS = ["google_ads", "meta", "ga4", "linkedin", "tiktok", "youtube", "other"] as const;
export type Channel = (typeof CHANNELS)[number];

export const clientChannels = pgTable("client_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  channel: text("channel").$type<Channel>().notNull(),
  externalAccountId: text("external_account_id").notNull(),
  label: text("label"),
  isActive: boolean("is_active").notNull().default(true),
  ...timestamps,
});

export const clientContacts = pgTable("client_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  isPrimary: boolean("is_primary").notNull().default(false),
  isApprover: boolean("is_approver").notNull().default(false),
  notes: text("notes"),
  ...timestamps,
});

export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  module: text("module").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  summary: text("summary").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const googleTokens = pgTable("google_tokens", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  scope: text("scope"),
  tokenType: text("token_type"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  ...timestamps,
});

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type ClientChannel = typeof clientChannels.$inferSelect;
export type ClientContact = typeof clientContacts.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type ActivityEntry = typeof activityLog.$inferSelect;

export const EMAIL_STATUSES = ["pending", "sending", "sent", "failed", "skipped"] as const;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  module: text("module").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  link: text("link"),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  readAt: timestamp("read_at", { withTimezone: true }),
  emailStatus: text("email_status").$type<EmailStatus>(),
  emailError: text("email_error"),
  emailedAt: timestamp("emailed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export type Notification = typeof notifications.$inferSelect;
