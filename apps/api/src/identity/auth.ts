export interface AuthenticatedPrincipal {
  userId: string;
  provider: string;
  subject: string;
  roles: ReadonlySet<string>;
  permissions: ReadonlySet<string>;
  scopes: ReadonlySet<string>;
}

export interface AuthenticationAdapter {
  verifyCredential(credential: string): Promise<{
    provider: string;
    subject: string;
    email?: string;
  }>;
}

export function hasPermission(
  principal: AuthenticatedPrincipal,
  permission: string
): boolean {
  return principal.permissions.has(permission);
}

export function hasScope(
  principal: AuthenticatedPrincipal,
  scopeType: string,
  scopeId: string
): boolean {
  return principal.scopes.has(`${scopeType}:${scopeId}`);
}

export function assertPermission(
  principal: AuthenticatedPrincipal,
  permission: string
): void {
  if (!hasPermission(principal, permission)) {
    throw new Error("FORBIDDEN");
  }
}

export function assertScopedPermission(
  principal: AuthenticatedPrincipal,
  permission: string,
  scopeType: string,
  scopeId: string
): void {
  assertPermission(principal, permission);

  if (!hasScope(principal, scopeType, scopeId)) {
    throw new Error("FORBIDDEN");
  }
}
