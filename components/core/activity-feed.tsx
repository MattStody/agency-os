import Link from "next/link";
import type { ActivityRow } from "@/lib/activity";
import { EmptyState } from "@/components/shell/page-header";

const TZ = "America/Toronto";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, weekday: "long", month: "long", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function ActivityFeed({
  entries,
  showClient = true,
  compact = false,
}: {
  entries: ActivityRow[];
  showClient?: boolean;
  compact?: boolean;
}) {
  if (entries.length === 0) return <EmptyState title="Nothing yet">Changes will show up here.</EmptyState>;

  const today = keyFmt.format(new Date());
  const groups = new Map<string, { label: string; rows: ActivityRow[] }>();
  for (const e of entries) {
    const key = keyFmt.format(e.createdAt);
    if (!groups.has(key)) groups.set(key, { label: key === today ? "Today" : dayFmt.format(e.createdAt), rows: [] });
    groups.get(key)!.rows.push(e);
  }

  return (
    <div className="space-y-5">
      {Array.from(groups.entries()).map(([key, g]) => (
        <div key={key}>
          {!compact && <p className="mb-2 text-xs font-medium text-muted-foreground">{g.label}</p>}
          <ol className="relative space-y-3 border-l border-brand-mist pl-5">
            {g.rows.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-brand-sea ring-4 ring-card" />
                <p className="text-sm text-foreground">{e.summary}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.actorName ?? "System"}
                  {showClient && e.clientSlug && (
                    <>
                      {" · "}
                      <Link href={`/c/${e.clientSlug}`} className="hover:text-brand-ink hover:underline">
                        {e.clientName}
                      </Link>
                    </>
                  )}
                  {" · "}
                  {compact ? `${g.label === "Today" ? "" : `${g.label}, `}${timeFmt.format(e.createdAt)}` : timeFmt.format(e.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
