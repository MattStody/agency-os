import { notFound } from "next/navigation";
import { ItemForm } from "@/components/approvals/item-form";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/lib/db/client";
import { can } from "@/lib/permissions";
import { requireClient } from "@/lib/shell";
import { updateItemAction } from "@/modules/approvals/actions";
import { getItemDetail } from "@/modules/approvals/service";

export const metadata = { title: "Edit approval item" };

export default async function EditApprovalPage({ params }: { params: { client: string; itemId: string } }) {
  const { access, client } = await requireClient(params.client);
  if (!can(access, "approvals.manage")) notFound();
  const d = await getItemDetail(getDb(), access, client.id, params.itemId).catch(() => notFound());
  const { item } = d;
  return (
    <>
      <PageHeader eyebrow={`${client.name} · Approvals`} title="Edit details" />
      <Card>
        <CardContent className="pt-6">
          <ItemForm
            action={updateItemAction.bind(null, client.id, client.slug, item.id)}
            initial={{ type: item.type, title: item.title, description: item.description, dueAt: item.dueAt, sourceRef: item.sourceRef, copy: d.current?.copy ?? {} }}
            copyEditable={item.status === "draft"}
            submitLabel="Save"
          />
        </CardContent>
      </Card>
    </>
  );
}
