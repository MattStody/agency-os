import { notFound } from "next/navigation";
import { ChannelsEditor } from "@/components/core/channels-editor";
import { ClientForm } from "@/components/core/client-form";
import { ContactsEditor } from "@/components/core/contacts-editor";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDb } from "@/lib/db/client";
import { can } from "@/lib/permissions";
import { requireClient } from "@/lib/shell";
import {
  addChannelAction,
  addContactAction,
  removeChannelAction,
  removeContactAction,
  updateClientAction,
  updateContactAction,
} from "@/modules/core/actions";
import { getClientDetail } from "@/modules/core/service";

export const metadata = { title: "Client settings" };

export default async function ClientSettingsPage({
  params,
  searchParams,
}: {
  params: { client: string };
  searchParams: { saved?: string; created?: string };
}) {
  const { access, client } = await requireClient(params.client);
  if (!can(access, "clients.edit")) notFound();
  const { channels, contacts } = await getClientDetail(getDb(), access, client.id);
  const id = client.id;

  return (
    <>
      <PageHeader eyebrow={client.name} title="Client settings" description="Profile, connected ad accounts and contacts." />

      {(searchParams.saved || searchParams.created) && (
        <p role="status" className="mb-6 rounded-md bg-brand-mint/30 px-4 py-2.5 text-sm text-brand-ink">
          {searchParams.created ? "Client created. Add their ad accounts and contacts below." : "Changes saved."}
        </p>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientForm
              action={updateClientAction.bind(null, id)}
              client={client}
              canChangeStatus={can(access, "clients.status")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channels &amp; ad accounts</CardTitle>
            <CardDescription>Used by Approvals (Meta) and, later, Reporting.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChannelsEditor
              channels={channels}
              addAction={addChannelAction.bind(null, id)}
              removeActions={Object.fromEntries(channels.map((ch) => [ch.id, removeChannelAction.bind(null, id, ch.id)]))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contacts</CardTitle>
            <CardDescription>Approvers can sign off on ads and clips once Approvals is live.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContactsEditor
              contacts={contacts}
              addAction={addContactAction.bind(null, id)}
              updateActions={Object.fromEntries(contacts.map((c) => [c.id, updateContactAction.bind(null, id, c.id)]))}
              removeActions={Object.fromEntries(contacts.map((c) => [c.id, removeContactAction.bind(null, id, c.id)]))}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
