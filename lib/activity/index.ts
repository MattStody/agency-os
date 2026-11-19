// Activity log. Call logActivity() inside the same withAccess() transaction as
// the change it describes, so the entry and the change commit (or fail) together.
import { desc, eq, isNull, sql } from "drizzle-orm";
import { activityLog, clients, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/types";
import type { Access } from "@/lib/permissions";

export interface ActivityInput {
  clientId: string | null;
  module: string;
  action: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function logActivity(tx: Db, access: Access, input: ActivityInput) {
  await tx.insert(activityLog).values({
    clientId: input.clientId,
    actorId: access.userId,
    module: input.module,
    action: input.action,
    summary: input.summary,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
}

export interface ActivityRow {
  id: string;
  createdAt: Date;
  module: string;
  action: string;
  summary: string;
  actorName: string | null;
  clientName: string | null;
  clientSlug: string | null;
}

/** Recent activity visible to the caller (RLS limits rows to their clients). */
export async function listActivity(
  tx: Db,
  opts: { clientId?: string; globalOnly?: boolean; limit?: number } = {}
): Promise<ActivityRow[]> {
  const where = opts.clientId
    ? eq(activityLog.clientId, opts.clientId)
    : opts.globalOnly
      ? isNull(activityLog.clientId)
      : undefined;
  return tx
    .select({
      id: activityLog.id,
      createdAt: activityLog.createdAt,
      module: activityLog.module,
      action: activityLog.action,
      summary: activityLog.summary,
      actorName: sql<string | null>`coalesce(${users.name}, ${users.email})`,
      clientName: clients.name,
      clientSlug: clients.slug,
    })
    .from(activityLog)
    .leftJoin(users, eq(users.id, activityLog.actorId))
    .leftJoin(clients, eq(clients.id, activityLog.clientId))
    .where(where)
    .orderBy(desc(activityLog.createdAt))
    .limit(opts.limit ?? 50);
}
