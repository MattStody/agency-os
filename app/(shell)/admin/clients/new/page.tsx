import { ClientForm } from "@/components/core/client-form";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";
import { createClientAction } from "@/modules/core/actions";

export const metadata = { title: "New client" };

export default async function NewClientPage() {
  await requirePermission("clients.create");
  return (
    <>
      <PageHeader eyebrow="Clients" title="New client" description="You can add ad accounts and contacts on the next screen." />
      <Card>
        <CardContent className="pt-6">
          <ClientForm action={createClientAction} />
        </CardContent>
      </Card>
    </>
  );
}
