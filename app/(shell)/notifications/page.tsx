import { Bell } from "lucide-react";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { ActionButton } from "@/components/forms/action-button";
import { Card } from "@/components/ui/card";
import { requireAccess } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { markAllReadAction } from "./actions";

export const metadata = { title: "Notifications" };

const when = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function NotificationsPage() {
  const access = await requireAccess();
  const items = await listNotifications(getDb(), access, 100);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're up to date."}
        actions={unread > 0 && <ActionButton variant="outline" size="sm" action={markAllReadAction}>Mark all as read</ActionButton>}
      />
      {items.length === 0 ? (
        <EmptyState title="No notifications yet">You&rsquo;ll hear about approvals and comments here.</EmptyState>
      ) : (
        <Card className="divide-y">
          {items.map((n) => (
            <Link
              key={n.id}
              href={`/notifications/${n.id}`}
              className={cn("flex gap-3 px-5 py-4 transition hover:bg-brand-paper/50", !n.readAt && "bg-brand-periwinkle/[0.06]")}
            >
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-periwinkle")} />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", !n.readAt && "font-medium text-brand-ink")}>{n.title}</span>
                {n.body && <span className="mt-0.5 line-clamp-2 block text-sm text-muted-foreground">{n.body}</span>}
                <span className="mt-1 block text-xs text-muted-foreground">{when.format(n.createdAt)}</span>
              </span>
              <Bell className="mt-1 h-4 w-4 shrink-0 text-brand-sage" />
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}
