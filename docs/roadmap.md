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
- Sales orders — API lifecycle and frontend operational module implemented
- Invoices — API listing and lifecycle supported; frontend creation, issue/posting, and guarded void flow implemented
- Receivables — customer receivable listing with server-side payment-allocation/reversal-aware balance calculation and frontend module implemented
- Payments — create, paginated listing, allocation, and reversal flows with accounting posting/reversal and frontend module implemented
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
- Security/RBAC audit completed — authentication boundary, route permissions, ownership checks, resource-scope semantics, rate limiting, and production CORS fail-closed guard reviewed

## Phase 6 — Arabic PWA
- Preserve Arabic-first UX direction — foundation established
- RTL — foundation established
- Responsive layouts — foundation established
- Offline-safe shell — static shell only; API responses are not cached
- API integration — transport boundary established with bearer authentication and idempotency-aware POST support
- Customer module — active customer listing and creation flow implemented
- Sales orders module — customer/catalog-backed creation, paginated listing, confirmation, and cancellation implemented
- Invoices module — creation from confirmed orders, paginated listing, issue/posting, and guarded void implemented
- Receivables module — customer invoice balances and allocation-aware outstanding amounts implemented
- Payments module — recording, paginated listing, allocation, and reversal UI implemented
- Firebase Hosting configuration added
- Web typecheck/build/audit added to CI and verified successfully

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
