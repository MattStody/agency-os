import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ActivityFeed } from "@/components/core/activity-feed";
import { CHANNEL_LABELS, StatusBadge } from "@/components/core/labels";
import { EmptyState, PageHeader, SectionTitle } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listActivity } from "@/lib/activity";
import { requireAccess } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { withAccess } from "@/lib/db/scoped";
import { can } from "@/lib/permissions";
import { listClientSummaries } from "@/modules/core/service";

export const metadata = { title: "Home" };

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", hour: "numeric", hourCycle: "h23" }).format(new Date())
  );
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const access = await requireAccess();
  const db = getDb();
  const clients = await listClientSummaries(db, access);

  // Client users land straight on their own workspace.
  if (!access.isInternal) {
    if (clients[0]) redirect(`/c/${clients[0].slug}`);
  }

  const activity = can(access, "activity.view")
    ? await withAccess(db, access, (tx) => listActivity(tx, { limit: 8 }))
    : [];
  const firstName = access.name?.split(" ")[0];
  const active = clients.filter((c) => c.status === "active").length;

  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", dateStyle: "full" }).format(new Date())}
        title={`${greeting()}${firstName ? `, ${firstName}` : ""}.`}
        description={`${active} active client${active === 1 ? "" : "s"} across Boldly.`}
        actions={
          can(access, "clients.create") && (
            <Button asChild variant="outline">
              <Link href="/admin/clients/new">New client</Link>
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <SectionTitle>Clients</SectionTitle>
          {clients.length === 0 ? (
            <EmptyState title="No clients yet">Create the first client record to get started.</EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {clients.map((c) => (
                <Link key={c.id} href={`/c/${c.slug}`} className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Card className="flex h-full flex-col p-5 transition group-hover:border-brand-sage group-hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-serif text-xl leading-tight text-brand-ink">{c.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[c.industry, c.city].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-brand-ink" />
                    </div>
                    <p className="mt-4 line-clamp-2 text-sm text-muted-foreground">{c.services.join(" · ") || "No services listed"}</p>
                    <div className="mt-auto flex items-center justify-between pt-5">
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(new Set(c.channels.map((ch) => ch.channel))).map((ch) => (
                          <span key={ch} className="rounded-md bg-brand-paper px-2 py-0.5 text-[11px] font-medium text-brand-sea">
                            {CHANNEL_LABELS[ch]}
                          </span>
                        ))}
                      </div>
                      <StatusBadge status={c.status} />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        {can(access, "activity.view") && (
          <section>
            <SectionTitle
              action={
                <Link href="/admin/activity" className="text-xs text-brand-sea hover:underline">
                  View all
                </Link>
              }
            >
              Recent activity
            </SectionTitle>
            <Card className="p-5">
              <ActivityFeed entries={activity} compact />
            </Card>
          </section>
        )}
      </div>
    </>
  );
}
