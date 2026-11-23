import { Clapperboard, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ApprovalStatus, ApprovalType } from "@/modules/approvals/schema";
import { STATUS_LABELS, TYPE_LABELS } from "@/modules/approvals/validation";

const VARIANT: Record<ApprovalStatus, "muted" | "periwinkle" | "warning" | "mint"> = {
  draft: "muted",
  pending: "periwinkle",
  changes_requested: "warning",
  approved: "mint",
  archived: "muted",
};

export function ApprovalStatusBadge({ status, clientView = false }: { status: ApprovalStatus; clientView?: boolean }) {
  // Clients see "Needs your review" rather than "Awaiting client".
  const label = clientView && status === "pending" ? "Needs your review" : STATUS_LABELS[status];
  return <Badge variant={VARIANT[status]}>{label}</Badge>;
}

export function TypeLabel({ type, className }: { type: ApprovalType; className?: string }) {
  const Icon = type === "clip" ? Clapperboard : Megaphone;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <Icon className="h-3.5 w-3.5" /> {TYPE_LABELS[type]}
    </span>
  );
}

const dueFmt = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });

/** Due date with "overdue" / "today" emphasis for open items. */
export function DueDate({ dueAt, open }: { dueAt: string | null; open: boolean }) {
  if (!dueAt) return <span className="text-muted-foreground">—</span>;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const d = new Date(`${dueAt}T00:00:00Z`);
  const overdue = open && dueAt < today;
  const isToday = open && dueAt === today;
  return (
    <span className={cn("tabular-nums", overdue ? "font-medium text-destructive" : isToday ? "font-medium text-amber-700" : "text-muted-foreground")}>
      {isToday ? "Today" : dueFmt.format(d)}
      {overdue && " · overdue"}
    </span>
  );
}

export function formatTimecode(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec < 10 ? "0" : ""}${sec.toFixed(sec % 1 ? 1 : 0)}`;
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}
