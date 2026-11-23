import { QueueList, QueueTabs, statusesFor } from "@/components/approvals/queue-list";
import { PageHeader } from "@/components/shell/page-header";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { listQueue, queueCounts } from "@/modules/approvals/service";

export const metadata = { title: "Approvals queue" };

export default async function ApprovalsQueuePage({ searchParams }: { searchParams: { status?: string } }) {
  const access = await requirePermission("approvals.manage");
  const db = getDb();
  const [rows, counts] = await Promise.all([
    listQueue(db, access, { statuses: statusesFor(searchParams.status, true) }),
    queueCounts(db, access),
  ]);
  return (
    <>
      <PageHeader
        eyebrow="Internal tools"
        title="Approvals queue"
        description="Everything waiting on a client or on us, across every client. Most urgent first."
      />
      <QueueTabs base="/tools/approvals" current={searchParams.status ?? "open"} counts={counts} internal />
      <QueueList rows={rows} showClient clientView={false} />
    </>
  );
}
