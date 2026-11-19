import { Badge } from "@/components/ui/badge";
import type { ClientStatus } from "@/lib/db/schema";

const STATUS: Record<ClientStatus, { label: string; variant: "mint" | "muted" | "warning" | "lavender" }> = {
  active: { label: "Active", variant: "mint" },
  prospect: { label: "Prospect", variant: "lavender" },
  paused: { label: "Paused", variant: "warning" },
  archived: { label: "Archived", variant: "muted" },
};

export function StatusBadge({ status }: { status: ClientStatus }) {
  const s = STATUS[status];
  return <Badge variant={s.variant}>{s.label}</Badge>;
}

export { CHANNEL_LABELS } from "@/modules/core/validation";
