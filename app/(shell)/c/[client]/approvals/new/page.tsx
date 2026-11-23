import { notFound } from "next/navigation";
import { ItemForm } from "@/components/approvals/item-form";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { can } from "@/lib/permissions";
import { requireClient } from "@/lib/shell";
import { createItemAction } from "@/modules/approvals/actions";

export const metadata = { title: "New approval item" };

export default async function NewApprovalPage({ params }: { params: { client: string } }) {
  const { access, client } = await requireClient(params.client);
  if (!can(access, "approvals.manage")) notFound();
  return (
    <>
      <PageHeader eyebrow={`${client.name} · Approvals`} title="New item" description="Save it as a draft, add the files, then send it to the client." />
      <Card>
        <CardContent className="pt-6">
          <ItemForm action={createItemAction.bind(null, client.id, client.slug)} submitLabel="Create draft" />
        </CardContent>
      </Card>
    </>
  );
}
