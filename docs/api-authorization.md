# Authorization Model — foundation/v1

Authentication and authorization are separate layers.
1. Authentication resolves a provider identity to an active local user.
2. Roles resolve to permissions through user_roles, roles, role_permissions, and permissions.
3. Resource scopes are loaded from user_access_scopes into the authenticated principal.
4. Domain services enforce resource ownership where the resource has an actor/owner relationship.

The API currently uses explicit permission checks at route boundaries through assertPermission. Resource ownership is enforced in the relevant domain service for campaigns, delivery orders, employee tasks, and driver collection sessions. The generic hasScope primitive is intentionally retained for future resources whose authorization is scope-based rather than actor-ownership-based.

## Route permission surface

| Domain | Read | Write / transition |
|---|---|---|
| Customers | customers.read | customers.write |
| Catalog | catalog.read | catalog.manage |
| Sales orders | sales.manage | sales.manage |
| Invoices | invoices.read | invoices.manage |
| Receivables | receivables.read | — |
| Payments | payments.read | payments.manage, payments.reverse |
| Delivery | delivery.read | delivery.manage, delivery.assign, delivery.status |
| Collections | collections.read | collections.manage |
| Exchange rates | exchange_rates.read | exchange_rates.manage |
| Accounting reports | accounting.journal.read | — |
| Accounting periods | accounting.journal.read | accounting.periods.manage |
| Accounting accounts | accounting.journal.read | accounting.accounts.manage |
| Accounting journals | accounting.journal.read | accounting.journal.post |
| Expenses | expenses.read | expenses.manage |
| Compensation | compensation.read | compensation.manage |
| Employee tasks | employee_tasks.read | employee_tasks.manage |
| Campaigns | campaigns.read | campaigns.manage, campaigns.spend |

All /api/v1/* routes require authentication before reaching their route handler.

## Fail-closed behavior

Missing credentials, invalid credentials, inactive users, and missing permissions do not grant access. Authentication failures terminate the request pipeline before route handlers run. Authentication-provider failures are not silently converted into invalid-credential responses; infrastructure failures are allowed to reach the API error boundary. Permission checks are exact string matches. Resource scopes are exact scopeType:scopeId matches.

This document describes the current foundation/v1 implementation; it does not claim that a concrete external identity provider has been configured. The runtime currently uses an explicit unconfigured authentication adapter until the production provider boundary is selected and wired.