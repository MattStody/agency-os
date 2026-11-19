import type { LucideIcon } from "lucide-react";
import type { Permission } from "@/lib/permissions";

/**
 * A Boldly OS module. Register it in modules/registry.ts and the shell picks
 * it up: nav entry, permission gating, and a "planned" placeholder page until
 * its real route exists. See docs/MODULES.md.
 */
export interface ModuleManifest {
  /** kebab-case, unique. Also the default URL segment. */
  id: string;
  name: string;
  /** One line, shown on the placeholder page and in tooling. */
  description: string;
  icon: LucideIcon;
  /**
   * client  → lives under the client switcher at /c/[client]/<path>; every query is client-scoped.
   * global  → not tied to one client (internal tools, admin) at /<path>. Internal staff only.
   */
  scope: "client" | "global";
  /** Sidebar group. "workspace" requires scope "client". */
  section: "workspace" | "tools" | "admin";
  /** live = routes exist. planned = nav stub + placeholder page. */
  status: "live" | "beta" | "planned";
  /** Users without this permission don't see the module at all. */
  requires: Permission;
  /**
   * Path relative to the scope root. Defaults: workspace → "<id>",
   * tools → "tools/<id>", admin → "admin/<id>". "" = the client overview.
   */
  path?: string;
  /** Lower first within a section. */
  order?: number;
}

export interface ResolvedModule extends ModuleManifest {
  path: string;
  order: number;
}
