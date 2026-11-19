import { ActivityFeed } from "@/components/core/activity-feed";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { listActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { withAccess } from "@/lib/db/scoped";
import { getSwitcherClients } from "@/lib/shell";

export const metadata = { title: "Activity" };

export default async function ActivityPage({ searchParams }: { searchParams: { client?: string } }) {
  const access = await requirePermission("activity.view");
  const clients = await getSwitcherClients();
  const filter = searchParams.client;
  const selected = clients.find((c) => c.slug === filter);
  const entries = await withAccess(getDb(), access, (tx) =>
    listActivity(tx, {
      clientId: selected?.id,
      globalOnly: filter === "_global",
      limit: 200,
    })
  );

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Activity"
        description="Who changed what, across every module."
        actions={
          <form className="flex items-center gap-2">
            <Select name="client" defaultValue={filter ?? ""} aria-label="Filter by client" className="w-56">
              <option value="">All activity</option>
              <option value="_global">Team &amp; settings</option>
              {clients.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="outline" size="sm">
              Filter
            </Button>
          </form>
        }
      />
      <Card className="p-6">
        <ActivityFeed entries={entries} showClient={!selected} />
      </Card>
    </>
  );
}
