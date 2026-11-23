import Link from "next/link";
import { notFound } from "next/navigation";
import { QueueList, QueueTabs, statusesFor } from "@/components/approvals/queue-list";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db/client";
import { can } from "@/lib/permissions";
import { requireClient } from "@/lib/shell";
import { listQueue, queueCounts } from "@/modules/approvals/service";

export const metadata = { title: "Approvals" };

export default async function ClientApprovalsPage({
  params,
  searchParams,
}: {
  params: { client: string };
  searchParams: { status?: string };
}) {
  const { access, client } = await requireClient(params.client);
  if (!can(access, "approvals.view")) notFound();
  const db = getDb();
  const tab = searchParams.status ?? "open";
  const [rows, counts] = await Promise.all([
    listQueue(db, access, { clientId: client.id, statuses: statusesFor(searchParams.status, access.isInternal) }),
    queueCounts(db, access, client.id),
  ]);

  return (
    <>
      <PageHeader
        eyebrow={client.name}
        title="Approvals"
        description={
          access.isInternal
            ? "Ads and clips waiting on the client, and their history."
            : "Review ads and clips from Boldly. Approve them or tell us what to change."
        }
        actions={
          can(access, "approvals.manage") && (
            <Button asChild>
              <Link href={`/c/${client.slug}/approvals/new`}>New item</Link>
            </Button>
          )
        }
      />
      <QueueTabs base={`/c/${client.slug}/approvals`} current={tab} counts={counts} internal={access.isInternal} />
      <QueueList rows={rows} showClient={false} clientView={!access.isInternal} />
    </>
  );
}
