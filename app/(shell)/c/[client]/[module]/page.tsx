// Placeholder for client-scoped modules that are registered but not built yet.
// A live module's own folder (e.g. c/[client]/approvals/) takes precedence over this route.
import { notFound } from "next/navigation";
import { PlannedModule } from "@/components/core/planned-module";
import { can } from "@/lib/permissions";
import { requireClient } from "@/lib/shell";
import { findModule } from "@/modules/registry";

export default async function ClientModulePlaceholder({ params }: { params: { client: string; module: string } }) {
  const { access, client } = await requireClient(params.client);
  const m = findModule("client", params.module);
  if (!m || m.status !== "planned" || !can(access, m.requires)) notFound();
  return <PlannedModule module={m} context={client.name} />;
}
