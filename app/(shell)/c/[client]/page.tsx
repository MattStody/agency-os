import { ExternalLink, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { ActivityFeed } from "@/components/core/activity-feed";
import { CHANNEL_LABELS, StatusBadge } from "@/components/core/labels";
import { EmptyState, PageHeader, SectionTitle } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { listActivity } from "@/lib/activity";
import { getDb } from "@/lib/db/client";
import { withAccess } from "@/lib/db/scoped";
import { can } from "@/lib/permissions";
import { requireClient } from "@/lib/shell";
import { queueCounts } from "@/modules/approvals/service";
import { getClientDetail } from "@/modules/core/service";
import { modulesFor } from "@/modules/registry";

export async function generateMetadata({ params }: { params: { client: string } }) {
  const { client } = await requireClient(params.client);
  return { title: client.name };
}

export default async function ClientOverviewPage({ params }: { params: { client: string } }) {
  const { access, client } = await requireClient(params.client);
  const db = getDb();
  const { channels, contacts } = await getClientDetail(db, access, client.id);
  const activity = can(access, "activity.view")
    ? await withAccess(db, access, (tx) => listActivity(tx, { clientId: client.id, limit: 10 }))
    : [];
  const approvals = can(access, "approvals.view") ? await queueCounts(db, access, client.id) : null;
  const workspaceModules = modulesFor(access).workspace.filter((m) => m.path !== "" && m.id !== "client-settings");

  return (
    <>
      <PageHeader
        eyebrow={[client.industry, client.city].filter(Boolean).join(" · ") || "Client"}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {client.name} <StatusBadge status={client.status} />
          </span>
        }
        description={client.notes ?? undefined}
        actions={
          <>
            {client.website && (
              <Button asChild variant="ghost" size="sm">
                <a href={client.website} target="_blank" rel="noreferrer noopener">
                  Website <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            )}
            {can(access, "clients.edit") && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/c/${client.slug}/settings`}>Edit client</Link>
              </Button>
            )}
          </>
        }
      />

      {approvals && approvals.pending + approvals.changes_requested > 0 && (
        <Link
          href={`/c/${client.slug}/approvals${access.isInternal ? "" : "?status=pending"}`}
          className="mb-8 flex items-center justify-between gap-4 rounded-xl border border-brand-periwinkle/40 bg-brand-periwinkle/10 px-5 py-4 transition hover:border-brand-periwinkle"
        >
          <span className="text-sm text-brand-ink">
            {access.isInternal ? (
              <>
                <strong className="font-semibold">{approvals.pending}</strong> awaiting the client ·{" "}
                <strong className="font-semibold">{approvals.changes_requested}</strong> with changes requested
              </>
            ) : approvals.pending > 0 ? (
              <>
                <strong className="font-semibold">{approvals.pending}</strong> item{approvals.pending === 1 ? "" : "s"} waiting for your review
              </>
            ) : (
              "Boldly is working on your requested changes."
            )}
          </span>
          <span className="text-sm font-medium text-brand-ink">Open approvals →</span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-8">
          <section>
            <SectionTitle>Services</SectionTitle>
            {client.services.length ? (
              <div className="flex flex-wrap gap-2">
                {client.services.map((s) => (
                  <Badge key={s} variant="periwinkle" className="px-3 py-1 text-[13px] font-normal">
                    {s}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No services recorded.</p>
            )}
          </section>

          <section>
            <SectionTitle>Channels &amp; ad accounts</SectionTitle>
            {channels.length === 0 ? (
              <EmptyState title="No accounts connected">Add ad account and property IDs in client settings.</EmptyState>
            ) : (
              <Card>
                <Table>
                  <THead>
                    <TR className="hover:bg-transparent">
                      <TH>Channel</TH>
                      <TH>Account</TH>
                      <TH className="text-right">ID</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {channels.map((ch) => (
                      <TR key={ch.id}>
                        <TD className="font-medium text-brand-ink">{CHANNEL_LABELS[ch.channel]}</TD>
                        <TD className="text-muted-foreground">{ch.label ?? "—"}</TD>
                        <TD className="text-right font-mono text-[12.5px] text-brand-sea">{ch.externalAccountId}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </Card>
            )}
          </section>

          {workspaceModules.length > 0 && (
            <section>
              <SectionTitle>Workspace</SectionTitle>
              <div className="grid gap-3 sm:grid-cols-2">
                {workspaceModules.map((m) => {
                  const Icon = m.icon;
                  return (
                    <Link
                      key={m.id}
                      href={`/c/${client.slug}/${m.path}`}
                      className="flex items-start gap-3 rounded-xl border bg-card p-4 transition hover:border-brand-sage"
                    >
                      <span className="rounded-lg bg-brand-paper p-2 text-brand-sea">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm font-medium text-brand-ink">
                          {m.name}
                          {m.status === "planned" && <Badge variant="muted">Soon</Badge>}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{m.description}</span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        <div className="space-y-8">
          <section>
            <SectionTitle>Contacts</SectionTitle>
            <Card className="divide-y">
              {contacts.length === 0 && <p className="p-5 text-sm text-muted-foreground">No contacts yet.</p>}
              {contacts.map((ct) => (
                <div key={ct.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-brand-ink">{ct.name}</p>
                    <div className="flex gap-1">
                      {ct.isPrimary && <Badge variant="mint">Primary</Badge>}
                      {ct.isApprover && <Badge variant="lavender">Approver</Badge>}
                    </div>
                  </div>
                  {ct.title && <p className="text-xs text-muted-foreground">{ct.title}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-brand-sea">
                    {ct.email && (
                      <a href={`mailto:${ct.email}`} className="inline-flex items-center gap-1 hover:underline">
                        <Mail className="h-3 w-3" /> {ct.email}
                      </a>
                    )}
                    {ct.phone && (
                      <a href={`tel:${ct.phone}`} className="inline-flex items-center gap-1 hover:underline">
                        <Phone className="h-3 w-3" /> {ct.phone}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          </section>

          {can(access, "activity.view") && (
            <section>
              <SectionTitle>Recent activity</SectionTitle>
              <Card className="p-5">
                <ActivityFeed entries={activity} showClient={false} compact />
              </Card>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
