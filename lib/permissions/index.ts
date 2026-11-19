// Roles, permissions and the per-request Access object.
// Pure functions only (no DB, no Next) so they're trivially unit-testable.
import type { Membership, Role, User } from "@/lib/db/schema";

export const PERMISSIONS = [
  "clients.view",
  "clients.create",
  "clients.edit",
  "clients.status", // change status (pause / archive)
  "activity.view",
  "team.view",
  "team.manage",
  "tools.use", // internal tools (global modules)
  "approvals.view",
  "approvals.manage", // create / upload / archive items
  "approvals.decide", // approve / request changes
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  team: [
    "clients.view",
    "clients.edit",
    "activity.view",
    "team.view",
    "tools.use",
    "approvals.view",
    "approvals.manage",
    "approvals.decide",
  ],
  client_user: ["clients.view", "approvals.view", "approvals.decide"],
};

// Highest wins when a user holds several memberships.
const ROLE_RANK: Record<Role, number> = { admin: 3, team: 2, client_user: 1 };

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  team: "Team member",
  client_user: "Client user",
};

export interface Access {
  userId: string;
  email: string;
  name: string | null;
  role: Role;
  isInternal: boolean;
  /** "all" = every client; otherwise the explicit list of client ids. */
  clientIds: "all" | string[];
  permissions: ReadonlySet<Permission>;
}

export class ForbiddenError extends Error {
  constructor(message = "You don't have access to that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function isInternalRole(role: Role): boolean {
  return role === "admin" || role === "team";
}

export function permissionsFor(role: Role): ReadonlySet<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}

/**
 * Builds the Access for a user from their memberships. Returns null when the
 * user is inactive or has no memberships (= no access at all).
 * A NULL client_id grants every client, but only for internal roles.
 */
export function buildAccess(
  user: Pick<User, "id" | "email" | "name" | "isActive">,
  memberships: Pick<Membership, "role" | "clientId">[]
): Access | null {
  if (!user.isActive || memberships.length === 0) return null;

  const role = memberships.reduce<Role>(
    (best, m) => (ROLE_RANK[m.role] > ROLE_RANK[best] ? m.role : best),
    memberships[0].role
  );
  const isInternal = isInternalRole(role);

  const allClients = memberships.some(
    (m) => m.clientId === null && isInternalRole(m.role)
  );
  const clientIds = allClients
    ? "all"
    : Array.from(
        new Set(memberships.map((m) => m.clientId).filter((id): id is string => !!id))
      );

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    role,
    isInternal,
    clientIds,
    permissions: permissionsFor(role),
  };
}

export function can(access: Access, permission: Permission): boolean {
  return access.permissions.has(permission);
}

export function canAccessClient(access: Access, clientId: string): boolean {
  return access.clientIds === "all" || access.clientIds.includes(clientId);
}

export function assertCan(access: Access, permission: Permission): void {
  if (!can(access, permission)) throw new ForbiddenError();
}

export function assertClientAccess(access: Access, clientId: string): void {
  if (!canAccessClient(access, clientId)) throw new ForbiddenError();
}
