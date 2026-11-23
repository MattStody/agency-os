import { cn } from "@/lib/utils";
import type { DecisionView, VersionView } from "@/modules/approvals/service";

const when = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

interface Event {
  at: Date;
  text: string;
  detail?: string | null;
  tone: "neutral" | "sent" | "approved" | "changes";
}

export function ApprovalHistory({ versions, decisions }: { versions: VersionView[]; decisions: DecisionView[] }) {
  const events: Event[] = [];
  for (const v of versions) {
    events.push({
      at: v.createdAt,
      text: `Version ${v.versionNo} created${v.createdByName ? ` by ${v.createdByName}` : ""}`,
      detail: v.notes,
      tone: "neutral",
    });
    if (v.sentAt) {
      events.push({ at: v.sentAt, text: `Version ${v.versionNo} sent for approval${v.sentByName ? ` by ${v.sentByName}` : ""}`, tone: "sent" });
    }
  }
  for (const d of decisions) {
    const who = d.onBehalfOf ? `${d.onBehalfOf} (recorded by ${d.userName ?? "Boldly"})` : (d.userName ?? "Client");
    events.push({
      at: d.createdAt,
      text: `${who} ${d.decision === "approved" ? "approved" : "requested changes to"} version ${d.versionNo}`,
      detail: d.note,
      tone: d.decision === "approved" ? "approved" : "changes",
    });
  }
  events.sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <ol className="relative space-y-4 border-l border-brand-mist pl-5">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span
            className={cn(
              "absolute -left-[25px] top-1.5 h-2 w-2 rounded-full ring-4 ring-card",
              e.tone === "approved" ? "bg-emerald-600" : e.tone === "changes" ? "bg-amber-600" : e.tone === "sent" ? "bg-brand-periwinkle" : "bg-brand-sage"
            )}
          />
          <p className="text-sm">{e.text}</p>
          {e.detail && <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">“{e.detail}”</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">{when.format(e.at)}</p>
        </li>
      ))}
    </ol>
  );
}
