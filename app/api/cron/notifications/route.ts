// Retries notification emails that weren't sent inline (e.g. a provider blip).
// Vercel Cron calls this with "Authorization: Bearer $CRON_SECRET".
import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { deliverPendingEmails } from "@/lib/notifications/deliver";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const db = getDb();
  // Re-queue rows stuck in 'sending' (crashed run) and recent failures.
  await db.execute(sql`
    update notifications set email_status = 'pending'
    where (email_status = 'sending' and created_at < now() - interval '10 minutes')
       or (email_status = 'failed' and created_at > now() - interval '2 days')`);
  const result = await deliverPendingEmails(db);
  return NextResponse.json(result);
}
