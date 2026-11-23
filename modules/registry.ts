// The list of modules the shell knows about. To add one, run
//   npm run new:module -- <id> --name "Name" [--scope client|global]
// or add an import + entry by hand (see docs/MODULES.md).
import { can, type Access } from "@/lib/permissions";
import { approvalsModule, approvalsQueueModule } from "./approvals/manifest";
import { coreModules } from "./core/manifest";
import { invoicingModule } from "./invoicing/manifest";
import { portalModule } from "./portal/manifest";
import { reportingModule } from "./reporting/manifest";
import { tasksModule } from "./tasks/manifest";
// @new-module:import
import type { ModuleManifest, ResolvedModule } from "./types";

export const MODULES: ModuleManifest[] = [
  ...coreModules,
  approvalsModule,
  approvalsQueueModule,
  reportingModule,
  tasksModule,
  invoicingModule,
  portalModule,
  // @new-module:entry
];

export const SECTION_LABELS: Record<ModuleManifest["section"], string> = {
  workspace: "Client workspace",
  tools: "Internal tools",
  admin: "Admin",
};

export function resolveModule(m: ModuleManifest): ResolvedModule {
  const defaultPath =
    m.section === "workspace" ? m.id : m.section === "tools" ? `tools/${m.id}` : `admin/${m.id}`;
  return { ...m, path: m.path ?? defaultPath, order: m.order ?? 100 };
}

export const RESOLVED_MODULES: ResolvedModule[] = MODULES.map(resolveModule);

/** Modules this user may see, grouped by section and ordered. Global modules are internal-only. */
export function modulesFor(access: Access) {
  const visible = RESOLVED_MODULES.filter(
    (m) => can(access, m.requires) && (m.scope === "client" || access.isInternal)
  );
  const bySection = (s: ModuleManifest["section"]) =>
    visible.filter((m) => m.section === s).sort((a, b) => a.order - b.order);
  return {
    workspace: bySection("workspace"),
    tools: bySection("tools"),
    admin: bySection("admin"),
  };
}

/** Look up a module by scope + URL path (used by the placeholder routes). */
export function findModule(scope: ModuleManifest["scope"], path: string): ResolvedModule | undefined {
  return RESOLVED_MODULES.find((m) => m.scope === scope && m.path === path);
}
