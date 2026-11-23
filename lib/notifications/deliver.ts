// Email delivery job for notifications with email_status = 'pending'.
// Runs with the owner connection on purpose: it's a system job that must read
// recipient addresses regardless of who triggered the notification (e.g. a
// client user approving can't read staff emails under RLS). It sends only to
// the recipient stored on each row and never exposes data to the caller.
import { and, eq, inArray, sql } from "drizzle-orm";
import { defaultTransport, renderEmail, type EmailTransport } from "@/lib/email";
import { notifications, users } from "@/lib/db/schema";
import { rowsOf, type Db } from "@/lib/db/types";

export interface DeliveryResult {
  sent: number;
  failed: number;
  skipped: number;
}

export async function deliverPendingEmails(
  db: Db,
  transport: EmailTransport = defaultTransport(),
  limit = 50
): Promise<DeliveryResult> {
  // Claim a batch atomically so concurrent runs never double-send.
  const claimed = rowsOf<{ id: string }>(
    await db.execute(sql`
      update notifications set email_status = 'sending'
      where id in (
        select id from notifications
        where email_status = 'pending'
        order by created_at
        limit ${limit}
        for update skip locked
      )
      returning id`)
  ).map((r) => r.id);
  if (claimed.length === 0) return { sent: 0, failed: 0, skipped: 0 };

  const rows = await db
    .select({
      id: notifications.id,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      email: users.email,
      active: users.isActive,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.userId))
    .where(inArray(notifications.id, claimed));

  const result: DeliveryResult = { sent: 0, failed: 0, skipped: 0 };
  for (const r of rows) {
    if (!r.active) {
      await db.update(notifications).set({ emailStatus: "skipped" }).where(eq(notifications.id, r.id));
      result.skipped++;
      continue;
    }
    try {
      const { text, html } = renderEmail({ title: r.title, body: r.body, link: r.link });
      await transport.send({ to: r.email, subject: r.title, text, html });
      await db
        .update(notifications)
        .set({ emailStatus: "sent", emailedAt: new Date(), emailError: null })
        .where(and(eq(notifications.id, r.id), eq(notifications.emailStatus, "sending")));
      result.sent++;
    } catch (e) {
      await db
        .update(notifications)
        .set({ emailStatus: "failed", emailError: e instanceof Error ? e.message.slice(0, 500) : "unknown" })
        .where(eq(notifications.id, r.id));
      result.failed++;
    }
  }
  return result;
}

/** Best-effort send right after a user action; the cron job retries anything left. */
export async function flushEmailsSoon(db: Db): Promise<void> {
  try {
    await deliverPendingEmails(db);
  } catch (e) {
    console.error("Email delivery failed:", e);
  }
}
