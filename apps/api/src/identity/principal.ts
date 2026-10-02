import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  permissions,
  rolePermissions,
  roles,
  userAccessScopes,
  userRoles,
  users
} from "../db/schema.js";
import type { AuthenticatedPrincipal } from "./auth.js";

export async function resolvePrincipal(
  db: Database,
  identity: { provider: string; subject: string }
): Promise<AuthenticatedPrincipal | null> {
  const rows = await db.select({
    userId: users.id,
    userStatus: users.status,
    roleCode: roles.code,
    permissionCode: permissions.code
  })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(
      eq(users.status, "active"),
      eq(users.id, identity.subject)
    ));

  if (rows.length === 0) return null;

  const rolesSet = new Set<string>();
  const permissionsSet = new Set<string>();
  const userId = rows[0]!.userId;

  for (const row of rows) {
    rolesSet.add(row.roleCode);
    if (row.permissionCode) permissionsSet.add(row.permissionCode);
  }

  const scopeRows = await db.select({
    scopeType: userAccessScopes.scopeType,
    scopeId: userAccessScopes.scopeId
  }).from(userAccessScopes).where(eq(userAccessScopes.userId, userId));

  const scopes = new Set(scopeRows.map((row) => `${row.scopeType}:${row.scopeId}`));

  return {
    userId,
    provider: identity.provider,
    subject: identity.subject,
    roles: rolesSet,
    permissions: permissionsSet,
    scopes
  };
}
