// Scaffolds a new module and registers it.
//   npm run new:module -- <id> --name "Name" [--scope client|global] [--section tools|admin|workspace]
//                         [--permission tools.use] [--planned]
// See docs/MODULES.md.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const id = process.argv[2];
if (!id || id.startsWith("--") || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('Usage: npm run new:module -- <kebab-id> --name "Display name" [--scope client|global]');
  process.exit(1);
}
const name = arg("--name") ?? id.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const scope = (arg("--scope") ?? "global") as "client" | "global";
const section = arg("--section") ?? (scope === "client" ? "workspace" : "tools");
const permission = arg("--permission") ?? (scope === "client" ? "clients.view" : "tools.use");
const planned = process.argv.includes("--planned");
const camel = id.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
const exportName = `${camel}Module`;

if (scope === "client" && section !== "workspace") throw new Error("Client-scoped modules belong in the workspace section.");
if (scope === "global" && section === "workspace") throw new Error("Global modules go in tools or admin.");

const root = process.cwd();
const modDir = path.join(root, "modules", id);
if (existsSync(modDir)) throw new Error(`modules/${id} already exists.`);
mkdirSync(modDir, { recursive: true });

writeFileSync(
  path.join(modDir, "manifest.ts"),
  `import { Wrench } from "lucide-react";
import type { ModuleManifest } from "../types";

export const ${exportName}: ModuleManifest = {
  id: "${id}",
  name: "${name}",
  description: "TODO: one line on what ${name} does.",
  icon: Wrench,
  scope: "${scope}",
  section: "${section}",
  status: "${planned ? "planned" : "beta"}",
  requires: "${permission}",
};
`
);

if (!planned) {
  const isClient = scope === "client";
  writeFileSync(
    path.join(modDir, "page.tsx"),
    isClient
      ? `import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { requireClient } from "@/lib/shell";
import { assertCan } from "@/lib/permissions";

// Client-scoped page. Read/write data via a service that uses withAccess() — see modules/core/service.ts.
export default async function ${camel[0].toUpperCase() + camel.slice(1)}Page({ params }: { params: { client: string } }) {
  const { access, client } = await requireClient(params.client);
  assertCan(access, "${permission}");
  return (
    <>
      <PageHeader eyebrow={client.name} title="${name}" />
      <Card className="p-6 text-sm text-muted-foreground">Build ${name} here.</Card>
    </>
  );
}
`
      : `import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/session";

export default async function ${camel[0].toUpperCase() + camel.slice(1)}Page() {
  await requirePermission("${permission}");
  return (
    <>
      <PageHeader eyebrow="${section === "admin" ? "Admin" : "Internal tools"}" title="${name}" />
      <Card className="p-6 text-sm text-muted-foreground">Build ${name} here.</Card>
    </>
  );
}
`
  );
  const routeDir = isClient
    ? path.join(root, "app", "(shell)", "c", "[client]", id)
    : path.join(root, "app", "(shell)", section === "admin" ? "admin" : "tools", id);
  mkdirSync(routeDir, { recursive: true });
  writeFileSync(path.join(routeDir, "page.tsx"), `export { default } from "@/modules/${id}/page";\n`);
}

const registryPath = path.join(root, "modules", "registry.ts");
let registry = readFileSync(registryPath, "utf8");
registry = registry
  .replace("// @new-module:import", `import { ${exportName} } from "./${id}/manifest";\n// @new-module:import`)
  .replace("  // @new-module:entry", `  ${exportName},\n  // @new-module:entry`);
writeFileSync(registryPath, registry);

console.log(`Created modules/${id}${planned ? " (planned stub)" : " and its route"}, registered in modules/registry.ts.`);
