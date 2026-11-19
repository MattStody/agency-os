// Placeholder for internal tools that are registered but not built yet.
import { notFound } from "next/navigation";
import { PlannedModule } from "@/components/core/planned-module";
import { requireAccess } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { findModule } from "@/modules/registry";

export default async function ToolPlaceholder({ params }: { params: { module: string } }) {
  const access = await requireAccess();
  const m = findModule("global", `tools/${params.module}`);
  if (!m || m.status !== "planned" || !access.isInternal || !can(access, m.requires)) notFound();
  return <PlannedModule module={m} context="Internal tools" />;
}
