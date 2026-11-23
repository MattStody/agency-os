import { describe, expect, it } from "vitest";
import { buildAccess } from "@/lib/permissions";
import { findModule, modulesFor, RESOLVED_MODULES } from "@/modules/registry";

const user = { id: "u", email: "u@x.test", name: null, isActive: true };

describe("module registry", () => {
  it("has unique ids and unique paths per scope", () => {
    const ids = RESOLVED_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    const paths = RESOLVED_MODULES.map((m) => `${m.scope}:${m.path}`);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("uses kebab-case ids and only client scope in the workspace section", () => {
    for (const m of RESOLVED_MODULES) {
      expect(m.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      if (m.section === "workspace") expect(m.scope).toBe("client");
      if (m.scope === "global") expect(m.path).toMatch(/^(tools|admin)\//);
    }
  });

  it("hides internal tools and admin from client users", () => {
    const client = buildAccess(user, [{ role: "client_user", clientId: "c" }])!;
    const nav = modulesFor(client);
    expect(nav.tools).toHaveLength(0);
    expect(nav.admin).toHaveLength(0);
    expect(nav.workspace.map((m) => m.id)).not.toContain("client-settings");
  });

  it("shows admins everything", () => {
    const admin = buildAccess(user, [{ role: "admin", clientId: null }])!;
    const nav = modulesFor(admin);
    expect(nav.workspace.length + nav.tools.length + nav.admin.length).toBe(RESOLVED_MODULES.length);
  });

  it("finds planned modules for the placeholder routes", () => {
    expect(findModule("client", "reporting")?.status).toBe("planned");
    expect(findModule("client", "approvals")?.status).toBe("live");
    expect(findModule("global", "tools/tasks")?.id).toBe("tasks");
  });
});
