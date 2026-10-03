# Implementation Roadmap

## Phase 0 — Foundation
- Repository baseline
- TypeScript backend
- Configuration
- Logging
- Health/readiness endpoints
- Error model
- Docker
- CI

## Phase 1 — Persistence
- PostgreSQL connection pool and lifecycle
- Explicit SQL migration runner with advisory locking and checksums
- Currency registry and exchange-rate persistence
- Decimal-safe money primitive
- Base audit/idempotency infrastructure
- Database readiness endpoint
- Transaction abstraction will be introduced with the first state-changing application use case

## Phase 2 — Identity & Access
- Authentication provider boundary
- Users
- Roles
- Permissions
- Resource scopes
- Session/token verification

## Phase 3 — First vertical slice
- Customers domain and persistence
- Customer API contract
- Server-side validation
- API integration boundary for the frontend

## Phase 4 — Business domains
- Catalog
- Sales orders
- Invoices
- Receivables
- Payments
- Campaigns and advertising partner scopes
- Delivery and driver workflows
- Driver collection sessions and manual settlement

## Phase 5 — Accounting integrity
- Payment reversal-aware receivables calculations
- Financial posting rules
- Reversal rules
- Period controls
- Reconciliation — operational-to-posted-journal consistency report implemented
- Reporting read models — trial balance, general ledger, reconciliation, income statement, and balance sheet implemented
- OpenAPI foundation/v1 transport contract snapshot added
- API transport contract hardened — standardized errors, idempotency, bounded pagination, and contract documentation implemented
- Fastify security dependency pinned to patched 5.12.5 release

## Phase 6 — Arabic PWA
- Preserve Arabic-first UX direction
- RTL
- Responsive layouts
- Offline-safe shell
- API integration

## Phase 7 — Verification
- Unit tests
- Integration tests
- Database tests
- Authorization tests
- Concurrency tests
- Idempotency tests
- API pagination/error-contract regression tests
- Backup/restore verification

## Phase 8 — Production
- Container images
- VPS
- PostgreSQL
- Reverse proxy/TLS
- Backups
- Monitoring
- CI/CD
