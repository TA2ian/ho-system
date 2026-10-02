# Architecture

The application is a modular monolith. We keep one deployable API while enforcing strict internal boundaries. This avoids premature microservices complexity while preserving a migration path if a bounded context later needs independent deployment.

```text
Browser / PWA
    |
    v
HTTP API
    |
    v
Application layer
    |
    v
Domain layer
    |
    v
Persistence
    |
    v
PostgreSQL
```

## Layers

### HTTP
Responsible for routing, authentication context extraction, request parsing, response mapping, and HTTP error handling. HTTP must not contain accounting rules.

### Application
Responsible for use cases, transaction boundaries, authorization checks, idempotency orchestration, and coordinating domain objects/repositories.

### Domain
Contains accounting and business invariants. It must not import Fastify, PostgreSQL drivers, authentication providers, or browser code.

### Persistence
Contains PostgreSQL repositories, migrations, transaction adapters, and database-specific queries.

## Initial bounded contexts

1. Identity & Access
2. Customers
3. Catalog
4. Sales
5. Invoicing
6. Receivables
7. Payments
8. Audit

The accounting ledger will be introduced only where business requirements require double-entry accounting; it will not be faked as a generic transaction table.

## Core invariants

- Monetary values use integer minor units or fixed-precision decimal; JavaScript floating point is never used for financial arithmetic.
- Posted financial documents are not silently edited or deleted.
- Reversals are represented explicitly.
- A state-changing request with an idempotency key produces one logical effect.
- Authorization is checked against role and resource scope.
- Audit events are append-only.

## Security baseline

- Secrets are environment-provided.
- Authentication is verified server-side.
- Authorization is enforced server-side.
- Input is validated at the API boundary.
- Database queries are parameterized.
- Sensitive actions are audited.
- Rate limiting and request-size limits are enabled.
- Client errors do not expose stack traces or secrets.
