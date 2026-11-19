// Core module business logic. Every function takes the root db + the caller's
// Access, checks permissions, and runs inside withAccess() so RLS applies.
// Server actions (actions.ts) are thin wrappers around these; tests call them directly.
import { and, asc, eq, ne } from "drizzle-orm";
import { logActivity } from "@/lib/activity";
import {
  clientChannels,
  clientContacts,
  clients,
  memberships,
  users,
  type Client,
  type ClientChannel,
  type ClientContact,
  type Role,
} from "@/lib/db/schema";
import { withAccess } from "@/lib/db/scoped";
import type { Db } from "@/lib/db/types";
import {
  assertCan,
  assertClientAccess,
  ForbiddenError,
  type Access,
} from "@/lib/permissions";
import {
  channelInputSchema,
  clientInputSchema,
  contactInputSchema,
  inviteInputSchema,
  CHANNEL_LABELS,
  type ChannelInput,
  type ClientInput,
  type ContactInput,
  type InviteInput,
} from "./validation";

const MODULE = "core";

export class NotFoundError extends Error {
  constructor(what = "Record") {
    super(`${what} not found.`);
    this.name = "NotFoundError";
  }
}

// ---------------------------------------------------------------- clients

export async function listClients(
  db: Db,
  access: Access,
  opts: { includeArchived?: boolean } = {}
): Promise<Client[]> {
  assertCan(access, "clients.view");
  return withAccess(db, access, (tx) =>
    tx
      .select()
      .from(clients)
      .where(opts.includeArchived ? undefined : ne(clients.status, "archived"))
      .orderBy(asc(clients.name))
  );
}

export interface ClientSummary extends Client {
  channels: Pick<ClientChannel, "channel" | "externalAccountId">[];
  contactCount: number;
}

/** Clients plus their connected channels, for the home dashboard and client index. */
export async function listClientSummaries(
  db: Db,
  access: Access,
  opts: { includeArchived?: boolean } = {}
): Promise<ClientSummary[]> {
  assertCan(access, "clients.view");
  return withAccess(db, access, async (tx) => {
    const list = await tx
      .select()
      .from(clients)
      .where(opts.includeArchived ? undefined : ne(clients.status, "archived"))
      .orderBy(asc(clients.name));
    const channels = await tx
      .select({
        clientId: clientChannels.clientId,
        channel: clientChannels.channel,
        externalAccountId: clientChannels.externalAccountId,
      })
      .from(clientChannels)
      .where(eq(clientChannels.isActive, true));
    const contacts = await tx.select({ clientId: clientContacts.clientId }).from(clientContacts);
    return list.map((c) => ({
      ...c,
      channels: channels.filter((ch) => ch.clientId === c.id),
      contactCount: contacts.filter((ct) => ct.clientId === c.id).length,
    }));
  });
}

/** Returns null when the client doesn't exist OR the caller can't see it (no existence leak). */
export async function getClientBySlug(db: Db, access: Access, slug: string): Promise<Client | null> {
  assertCan(access, "clients.view");
  const rows = await withAccess(db, access, (tx) =>
    tx.select().from(clients).where(eq(clients.slug, slug)).limit(1)
  );
  return rows[0] ?? null;
}

export interface ClientDetail {
  client: Client;
  channels: ClientChannel[];
  contacts: ClientContact[];
}

export async function getClientDetail(db: Db, access: Access, clientId: string): Promise<ClientDetail> {
  assertCan(access, "clients.view");
  assertClientAccess(access, clientId);
  return withAccess(db, access, async (tx) => {
    const [client] = await tx.select().from(clients).where(eq(clients.id, clientId));
    if (!client) throw new NotFoundError("Client");
    const channels = await tx
      .select()
      .from(clientChannels)
      .where(eq(clientChannels.clientId, clientId))
      .orderBy(asc(clientChannels.channel), asc(clientChannels.createdAt));
    const contacts = await tx
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, clientId))
      .orderBy(asc(clientContacts.name));
    return { client, channels, contacts };
  });
}

export async function createClient(db: Db, access: Access, input: ClientInput): Promise<Client> {
  assertCan(access, "clients.create");
  const data = clientInputSchema.parse(input);
  return withAccess(db, access, async (tx) => {
    const [client] = await tx.insert(clients).values(data).returning();
    await logActivity(tx, access, {
      clientId: client.id,
      module: MODULE,
      action: "client.created",
      entityType: "client",
      entityId: client.id,
      summary: `Created client ${client.name}`,
    });
    return client;
  });
}

export async function updateClient(
  db: Db,
  access: Access,
  clientId: string,
  input: ClientInput
): Promise<Client> {
  assertCan(access, "clients.edit");
  assertClientAccess(access, clientId);
  const data = clientInputSchema.parse(input);
  return withAccess(db, access, async (tx) => {
    const [before] = await tx.select().from(clients).where(eq(clients.id, clientId));
    if (!before) throw new NotFoundError("Client");
    if (data.status !== before.status) assertCan(access, "clients.status");
    const [client] = await tx.update(clients).set(data).where(eq(clients.id, clientId)).returning();
    const changed = (Object.keys(data) as (keyof typeof data)[]).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(client[k])
    );
    if (changed.length > 0) {
      await logActivity(tx, access, {
        clientId,
        module: MODULE,
        action: before.status !== client.status ? "client.status_changed" : "client.updated",
        entityType: "client",
        entityId: clientId,
        summary:
          before.status !== client.status
            ? `Changed status from ${before.status} to ${client.status}`
            : `Updated client details (${changed.join(", ")})`,
        metadata: { changed },
      });
    }
    return client;
  });
}

// --------------------------------------------------------------- channels

export async function addChannel(
  db: Db,
  access: Access,
  clientId: string,
  input: ChannelInput
): Promise<ClientChannel> {
  assertCan(access, "clients.edit");
  assertClientAccess(access, clientId);
  const data = channelInputSchema.parse(input);
  return withAccess(db, access, async (tx) => {
    const [channel] = await tx
      .insert(clientChannels)
      .values({ ...data, clientId })
      .returning();
    await logActivity(tx, access, {
      clientId,
      module: MODULE,
      action: "channel.added",
      entityType: "client_channel",
      entityId: channel.id,
      summary: `Added ${CHANNEL_LABELS[channel.channel]} account ${channel.externalAccountId}`,
    });
    return channel;
  });
}

export async function removeChannel(db: Db, access: Access, clientId: string, channelId: string) {
  assertCan(access, "clients.edit");
  assertClientAccess(access, clientId);
  await withAccess(db, access, async (tx) => {
    const [removed] = await tx
      .delete(clientChannels)
      .where(and(eq(clientChannels.id, channelId), eq(clientChannels.clientId, clientId)))
      .returning();
    if (!removed) throw new NotFoundError("Channel");
    await logActivity(tx, access, {
      clientId,
      module: MODULE,
      action: "channel.removed",
      entityType: "client_channel",
      entityId: channelId,
      summary: `Removed ${CHANNEL_LABELS[removed.channel]} account ${removed.externalAccountId}`,
    });
  });
}

// --------------------------------------------------------------- contacts

export async function addContact(
  db: Db,
  access: Access,
  clientId: string,
  input: ContactInput
): Promise<ClientContact> {
  assertCan(access, "clients.edit");
  assertClientAccess(access, clientId);
  const data = contactInputSchema.parse(input);
  return withAccess(db, access, async (tx) => {
    const [contact] = await tx
      .insert(clientContacts)
      .values({ ...data, clientId })
      .returning();
    await logActivity(tx, access, {
      clientId,
      module: MODULE,
      action: "contact.added",
      entityType: "client_contact",
      entityId: contact.id,
      summary: `Added contact ${contact.name}`,
    });
    return contact;
  });
}

export async function updateContact(
  db: Db,
  access: Access,
  clientId: string,
  contactId: string,
  input: ContactInput
): Promise<ClientContact> {
  assertCan(access, "clients.edit");
  assertClientAccess(access, clientId);
  const data = contactInputSchema.parse(input);
  return withAccess(db, access, async (tx) => {
    const [contact] = await tx
      .update(clientContacts)
      .set(data)
      .where(and(eq(clientContacts.id, contactId), eq(clientContacts.clientId, clientId)))
      .returning();
    if (!contact) throw new NotFoundError("Contact");
    await logActivity(tx, access, {
      clientId,
      module: MODULE,
      action: "contact.updated",
      entityType: "client_contact",
      entityId: contact.id,
      summary: `Updated contact ${contact.name}`,
    });
    return contact;
  });
}

export async function removeContact(db: Db, access: Access, clientId: string, contactId: string) {
  assertCan(access, "clients.edit");
  assertClientAccess(access, clientId);
  await withAccess(db, access, async (tx) => {
    const [removed] = await tx
      .delete(clientContacts)
      .where(and(eq(clientContacts.id, contactId), eq(clientContacts.clientId, clientId)))
      .returning();
    if (!removed) throw new NotFoundError("Contact");
    await logActivity(tx, access, {
      clientId,
      module: MODULE,
      action: "contact.removed",
      entityType: "client_contact",
      entityId: contactId,
      summary: `Removed contact ${removed.name}`,
    });
  });
}

// ------------------------------------------------------------------- team

export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  title: string | null;
  isActive: boolean;
  lastSignInAt: Date | null;
  role: Role;
}

/** Internal staff: users holding an all-clients admin/team membership. */
export async function listTeam(db: Db, access: Access): Promise<TeamMember[]> {
  assertCan(access, "team.view");
  return withAccess(db, access, async (tx) => {
    const rows = await tx
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        title: users.title,
        isActive: users.isActive,
        lastSignInAt: users.lastSignInAt,
        role: memberships.role,
      })
      .from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(ne(memberships.role, "client_user"))
      .orderBy(asc(users.name), asc(users.email));
    // A user could hold several internal memberships; keep the strongest.
    const byId = new Map<string, TeamMember>();
    for (const r of rows) {
      const prev = byId.get(r.id);
      if (!prev || (prev.role === "team" && r.role === "admin")) byId.set(r.id, r);
    }
    return Array.from(byId.values());
  });
}

export async function inviteTeamMember(db: Db, access: Access, input: InviteInput) {
  assertCan(access, "team.manage");
  const data = inviteInputSchema.parse(input);
  return withAccess(db, access, async (tx) => {
    const [existing] = await tx.select().from(users).where(eq(users.email, data.email));
    if (existing) throw new Error(`${data.email} already has an account.`);
    const [user] = await tx
      .insert(users)
      .values({ email: data.email, name: data.name ?? null, title: data.title ?? null })
      .returning();
    await tx.insert(memberships).values({ userId: user.id, clientId: null, role: data.role });
    await logActivity(tx, access, {
      clientId: null,
      module: MODULE,
      action: "team.invited",
      entityType: "user",
      entityId: user.id,
      summary: `Added ${user.name ?? user.email} as ${data.role === "admin" ? "an admin" : "a team member"}`,
    });
    return user;
  });
}

export async function setTeamRole(db: Db, access: Access, userId: string, role: "admin" | "team") {
  assertCan(access, "team.manage");
  if (userId === access.userId) {
    throw new ForbiddenError("You can't change your own role.");
  }
  await withAccess(db, access, async (tx) => {
    const updated = await tx
      .update(memberships)
      .set({ role })
      .where(and(eq(memberships.userId, userId), ne(memberships.role, "client_user")))
      .returning();
    if (updated.length === 0) throw new NotFoundError("Team member");
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    await logActivity(tx, access, {
      clientId: null,
      module: MODULE,
      action: "team.role_changed",
      entityType: "user",
      entityId: userId,
      summary: `Set ${user?.name ?? user?.email ?? "user"}'s role to ${role === "admin" ? "Admin" : "Team member"}`,
    });
  });
}

export async function setUserActive(db: Db, access: Access, userId: string, isActive: boolean) {
  assertCan(access, "team.manage");
  if (userId === access.userId) throw new ForbiddenError("You can't deactivate yourself.");
  await withAccess(db, access, async (tx) => {
    const [user] = await tx.update(users).set({ isActive }).where(eq(users.id, userId)).returning();
    if (!user) throw new NotFoundError("User");
    await logActivity(tx, access, {
      clientId: null,
      module: MODULE,
      action: isActive ? "team.reactivated" : "team.deactivated",
      entityType: "user",
      entityId: userId,
      summary: `${isActive ? "Reactivated" : "Deactivated"} ${user.name ?? user.email}`,
    });
  });
}
