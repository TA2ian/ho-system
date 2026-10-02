import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  authIdentities,
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
    roleCode: roles.code,
    permissionCode: permissions.code
  })
    .from(authIdentities)
    .innerJoin(users, eq(users.id, authIdentities.userId))
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(and(
      eq(authIdentities.provider, identity.provider),
      eq(authIdentities.subject, identity.subject),
      eq(users.status, "active")
    ));

  if (rows.length === 0) return null;

  const userId = rows[0]!.userId;
  const rolesSet = new Set(rows.map((row) => row.roleCode));
  const permissionsSet = new Set(
    rows.flatMap((row) => row.permissionCode ? [row.permissionCode] : [])
  );

  const scopeRows = await db.select({
    scopeType: userAccessScopes.scopeType,
    scopeId: userAccessScopes.scopeId
  })
    .from(userAccessScopes)
    .where(eq(userAccessScopes.userId, userId));

  return {
    userId,
    provider: identity.provider,
    subject: identity.subject,
    roles: rolesSet,
    permissions: permissionsSet,
    scopes: new Set(scopeRows.map((row) => `${row.scopeType}:${row.scopeId}`))
  };
}
