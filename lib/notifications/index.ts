// In-app notifications. notify() runs inside the caller's withAccess()
// transaction; emails go out afterwards via deliverPendingEmails().
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { notifications, type Notification } from "@/lib/db/schema";
import { withAccess } from "@/lib/db/scoped";
import type { Db } from "@/lib/db/types";
import type { Access } from "@/lib/permissions";

export interface NotifyInput {
  recipients: string[]; // user ids; the actor and duplicates are dropped
  clientId: string | null;
  module: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  entityType?: string;
  entityId?: string;
  email?: boolean;
}

export async function notify(tx: Db, access: Access, input: NotifyInput): Promise<number> {
  const to = Array.from(new Set(input.recipients)).filter((id) => id && id !== access.userId);
  if (to.length === 0) return 0;
  await tx.insert(notifications).values(
    to.map((userId) => ({
      userId,
      clientId: input.clientId,
      actorId: access.userId,
      module: input.module,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      emailStatus: input.email === false ? null : ("pending" as const),
    }))
  );
  return to.length;
}

export async function unreadCount(db: Db, access: Access): Promise<number> {
  const [row] = await withAccess(db, access, (tx) =>
    tx
      .select({ n: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, access.userId), isNull(notifications.readAt)))
  );
  return Number(row?.n ?? 0);
}

export async function listNotifications(db: Db, access: Access, limit = 50): Promise<Notification[]> {
  return withAccess(db, access, (tx) =>
    tx
      .select()
      .from(notifications)
      .where(eq(notifications.userId, access.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
  );
}

/** Marks read and returns the notification (null if it isn't the caller's). */
export async function markRead(db: Db, access: Access, id: string): Promise<Notification | null> {
  const rows = await withAccess(db, access, (tx) =>
    tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, access.userId)))
      .returning()
  );
  return rows[0] ?? null;
}

export async function markAllRead(db: Db, access: Access, ids?: string[]): Promise<void> {
  await withAccess(db, access, (tx) =>
    tx
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.userId, access.userId),
          isNull(notifications.readAt),
          ids ? inArray(notifications.id, ids) : undefined
        )
      )
  );
}
