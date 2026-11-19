import { describe, expect, it } from "vitest";
import {
  assertClientAccess,
  buildAccess,
  can,
  canAccessClient,
  ForbiddenError,
} from "@/lib/permissions";

const user = { id: "u1", email: "a@b.test", name: "A", isActive: true };
const A = "10000000-0000-4000-8000-00000000000a";
const B = "10000000-0000-4000-8000-00000000000b";

describe("buildAccess", () => {
  it("returns null with no memberships", () => {
    expect(buildAccess(user, [])).toBeNull();
  });

  it("returns null for inactive users", () => {
    expect(buildAccess({ ...user, isActive: false }, [{ role: "admin", clientId: null }])).toBeNull();
  });

  it("gives internal roles with a null client all clients", () => {
    const a = buildAccess(user, [{ role: "team", clientId: null }])!;
    expect(a.clientIds).toBe("all");
    expect(a.isInternal).toBe(true);
  });

  it("never gives a client user all clients", () => {
    const a = buildAccess(user, [{ role: "client_user", clientId: A }])!;
    expect(a.clientIds).toEqual([A]);
    expect(a.isInternal).toBe(false);
  });

  it("picks the strongest role across memberships", () => {
    const a = buildAccess(user, [
      { role: "client_user", clientId: A },
      { role: "admin", clientId: null },
    ])!;
    expect(a.role).toBe("admin");
  });

  it("restricted team members only get their listed clients", () => {
    const a = buildAccess(user, [{ role: "team", clientId: A }])!;
    expect(canAccessClient(a, A)).toBe(true);
    expect(canAccessClient(a, B)).toBe(false);
    expect(() => assertClientAccess(a, B)).toThrow(ForbiddenError);
  });
});

describe("role permissions", () => {
  const admin = buildAccess(user, [{ role: "admin", clientId: null }])!;
  const team = buildAccess(user, [{ role: "team", clientId: null }])!;
  const client = buildAccess(user, [{ role: "client_user", clientId: A }])!;

  it("only admins create clients and manage the team", () => {
    expect(can(admin, "clients.create")).toBe(true);
    expect(can(team, "clients.create")).toBe(false);
    expect(can(team, "team.manage")).toBe(false);
    expect(can(client, "team.manage")).toBe(false);
  });

  it("client users cannot edit clients, see activity or use internal tools", () => {
    expect(can(client, "clients.edit")).toBe(false);
    expect(can(client, "activity.view")).toBe(false);
    expect(can(client, "tools.use")).toBe(false);
    expect(can(client, "approvals.decide")).toBe(true);
  });
});
