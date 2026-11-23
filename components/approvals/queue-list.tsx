import { Film, MessageSquare } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ApprovalStatus } from "@/modules/approvals/schema";
import type { QueueRow } from "@/modules/approvals/service";
import { ApprovalStatusBadge, DueDate, TypeLabel } from "./labels";

const OPEN: ApprovalStatus[] = ["draft", "pending", "changes_requested"];

export function QueueList({ rows, showClient, clientView }: { rows: QueueRow[]; showClient: boolean; clientView: boolean }) {
  if (rows.length === 0) {
    return <EmptyState title={clientView ? "You're all caught up" : "Nothing here"}>{clientView ? "Nothing needs your review right now." : "No items match this view."}</EmptyState>;
  }
  return (
    <Card className="divide-y">
      {rows.map((r) => (
        <Link
          key={r.id}
          href={`/c/${r.clientSlug}/approvals/${r.id}`}
          className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-brand-paper/50 focus-visible:bg-brand-paper/60 focus-visible:outline-none"
        >
          <Thumb row={r} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-brand-ink">{r.title}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {showClient && <span className="font-medium text-brand-sea">{r.clientName}</span>}
              <TypeLabel type={r.type} />
              {r.versionNo && <span>v{r.versionNo}</span>}
              {r.commentCount > 0 && (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> {r.commentCount}
                </span>
              )}
            </div>
          </div>
          <div className="hidden w-28 text-right text-xs sm:block">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Needed by</p>
            <DueDate dueAt={r.dueAt} open={OPEN.includes(r.status)} />
          </div>
          <div className="w-36 text-right">
            <ApprovalStatusBadge status={r.status} clientView={clientView} />
          </div>
        </Link>
      ))}
    </Card>
  );
}

function Thumb({ row }: { row: QueueRow }) {
  const box = cn("relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-brand-paper", row.type === "clip" && "w-10");
  if (!row.thumb) return <div className={box} />;
  return (
    <div className={box}>
      {row.thumb.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.thumb.url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <>
          <video src={`${row.thumb.url}#t=0.5`} preload="metadata" muted playsInline className="h-full w-full object-cover" />
          <Film className="absolute bottom-1 right-1 h-3 w-3 text-white drop-shadow" />
        </>
      )}
      {row.assetCount > 1 && (
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[9px] font-medium text-white">{row.assetCount}</span>
      )}
    </div>
  );
}

/** Status filter tabs. */
export function QueueTabs({
  base,
  current,
  counts,
  internal,
}: {
  base: string;
  current: string;
  counts: Record<ApprovalStatus, number>;
  internal: boolean;
}) {
  const tabs: { key: string; label: string; n?: number }[] = [
    { key: "open", label: "Open", n: counts.pending + counts.changes_requested + (internal ? counts.draft : 0) },
    { key: "pending", label: internal ? "Awaiting client" : "Needs review", n: counts.pending },
    { key: "changes_requested", label: "Changes requested", n: counts.changes_requested },
    ...(internal ? [{ key: "draft", label: "Drafts", n: counts.draft }] : []),
    { key: "approved", label: "Approved", n: counts.approved },
    ...(internal ? [{ key: "archived", label: "Archived" }] : []),
  ];
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b" aria-label="Filter by status">
      {tabs.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={t.key === "open" ? base : `${base}?status=${t.key}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
              active ? "border-brand-ink font-medium text-brand-ink" : "border-transparent text-muted-foreground hover:text-brand-ink"
            )}
          >
            {t.label}
            {t.n !== undefined && t.n > 0 && (
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-brand-ink text-brand-paper" : "bg-muted")}>{t.n}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function statusesFor(key: string | undefined, internal: boolean): ApprovalStatus[] {
  switch (key) {
    case "pending":
    case "changes_requested":
    case "approved":
      return [key];
    case "draft":
    case "archived":
      return internal ? [key] : ["pending", "changes_requested"];
    default:
      return internal ? OPEN : ["pending", "changes_requested"];
  }
}
