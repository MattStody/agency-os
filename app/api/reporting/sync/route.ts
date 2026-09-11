import { NextResponse, type NextRequest } from "next/server";
import { runSync } from "@/lib/reporting";
import { isPeriodKey, parsePeriod } from "@/lib/reporting";
import type { ChannelKey } from "@/lib/reporting";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The scheduled sync. Vercel Cron calls this with
 * `Authorization: Bearer $CRON_SECRET` (see vercel.json); the same secret
 * works for a manual re-run:
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     "$APP_URL/api/reporting/sync?client=everlast&period=2026-08"
 */
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set; refusing to run the sync unauthenticated." },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const period = params.get("period");
  let from = params.get("from") ?? undefined;
  let to = params.get("to") ?? undefined;

  // ?period=YYYY-MM is shorthand for a whole month — the usual manual re-run.
  if (period) {
    if (!isPeriodKey(period)) {
      return NextResponse.json(
        { error: `Invalid period "${period}" — expected YYYY-MM.` },
        { status: 400 }
      );
    }
    const parsed = parsePeriod(period);
    from = parsed.start;
    to = parsed.end;
  }

  try {
    const result = await runSync({
      clientSlug: params.get("client") ?? undefined,
      source: (params.get("source") as ChannelKey | null) ?? undefined,
      from,
      to,
    });

    const failed = result.tasks.filter((task) => task.status === "failed");
    return NextResponse.json(result, { status: failed.length ? 207 : 200 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
