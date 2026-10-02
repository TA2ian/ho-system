# Identity & Access

Identity is provider-neutral. The API will not embed a dependency on a particular hosted authentication vendor.

## Authentication boundary

An authentication adapter will translate a verified external credential into a stable internal user identity:

- provider
- subject
- internal user ID
- authentication timestamp
- optional verified claims

The adapter is responsible for credential verification. Business modules receive an already-authenticated principal and must not parse provider tokens.

## Authorization model

Authorization has two dimensions:

1. Permission: what an actor is allowed to do.
2. Resource scope: which resources the actor may act on.

Roles group permissions. User access scopes restrict a role-bearing user to specific resource boundaries when required.

This is important for the advertising partner and customer experiences. A role such as `advertiser` grants the capability to manage campaigns, but it does not grant access to every campaign in the system.

## User lifecycle

Users are explicitly stateful:

- invited
- active
- disabled

Disabling a user is an authorization state change; it does not delete historical financial or audit records.

## Current roles

The initial system roles are owner, administrator, accountant, sales, operations, driver, advertiser, employee, and customer.

These are defaults, not immutable business rules. The permission model is the enforcement mechanism, and later domain-specific scopes will connect users to customers, advertisers, campaigns, and other resources.

## Security rules

- Authentication is verified server-side.
- Authorization is enforced server-side on every protected command/query.
- Provider subject identifiers are stored separately from internal user IDs.
- Access is denied by default when a permission or scope cannot be established.
- User/role/access changes are auditable.
