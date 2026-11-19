import Link from "next/link";
import { CHANNEL_LABELS, StatusBadge } from "@/components/core/labels";
import { EmptyState, PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { can } from "@/lib/permissions";
import { listClientSummaries } from "@/modules/core/service";

export const metadata = { title: "Clients" };

export default async function ClientsIndexPage({ searchParams }: { searchParams: { archived?: string } }) {
  const access = await requirePermission("clients.view");
  const showArchived = searchParams.archived === "1";
  const clients = await listClientSummaries(getDb(), access, { includeArchived: showArchived });

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Clients"
        description="Every client record in Boldly OS."
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href={showArchived ? "/admin/clients" : "/admin/clients?archived=1"}>
                {showArchived ? "Hide archived" : "Show archived"}
              </Link>
            </Button>
            {can(access, "clients.create") && (
              <Button asChild>
                <Link href="/admin/clients/new">New client</Link>
              </Button>
            )}
          </>
        }
      />
      {clients.length === 0 ? (
        <EmptyState title="No clients">Create a client to get started.</EmptyState>
      ) : (
        <Card>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Client</TH>
                <TH className="hidden md:table-cell">Services</TH>
                <TH className="hidden lg:table-cell">Channels</TH>
                <TH className="hidden sm:table-cell">Contacts</TH>
                <TH className="text-right">Status</TH>
              </TR>
            </THead>
            <TBody>
              {clients.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <Link href={`/c/${c.slug}`} className="font-medium text-brand-ink hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{[c.industry, c.city].filter(Boolean).join(" · ")}</p>
                  </TD>
                  <TD className="hidden max-w-[280px] truncate text-muted-foreground md:table-cell">{c.services.join(", ") || "—"}</TD>
                  <TD className="hidden text-muted-foreground lg:table-cell">
                    {Array.from(new Set(c.channels.map((ch) => CHANNEL_LABELS[ch.channel]))).join(", ") || "—"}
                  </TD>
                  <TD className="hidden tabular-nums text-muted-foreground sm:table-cell">{c.contactCount}</TD>
                  <TD className="text-right">
                    <StatusBadge status={c.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}
