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
- Campaigns and advertising partner scopes — API lifecycle, spend/reversal, audit protection, and responsive operational frontend implemented
- Customer 360 expansion — normalized customer profile resources, media agreements, customer-linked operational history, and server-authoritative media-buyer relationships are specified separately before frontend expansion
- Delivery and driver workflows — responsive operational frontend implemented on the existing assignment/status/collection API
- Driver collection sessions and manual settlement — session open/view/close UI implemented

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
- Campaigns module — campaign creation, lifecycle transitions, spend recording, immutable reversal flow, detail financial snapshot, and responsive operational UI implemented
- Delivery/driver module — delivery creation, driver assignment, lifecycle transitions, receivable snapshot, driver collection session controls, and collection entry UI implemented
- Firebase Hosting configuration added
- Web typecheck/build/audit added to CI and verified successfully

## Phase 7 — Verification
- Unit tests — domain, pagination, idempotency hashing, rate limiting, authentication, authorization, and delivery lifecycle coverage established
- Integration tests — database migration verification is automated in CI
- Database tests — schema/table/trigger/accounting constraints plus driver-collection concurrency guard verified by db:verify
- Authorization tests — exact permission/scope semantics and missing/invalid authentication paths covered
- Concurrency tests — simultaneous open collection sessions for one driver are rejected by a database unique partial index and exercised in db:verify
- Idempotency tests — canonical request hashing, replay/conflict semantics, and concurrent database-backed race handling verified in db:verify
- API pagination/error-contract regression tests — bounded pagination and authentication/error contract coverage established
- Backup/restore verification — automated CI round-trip backup/restore check passed successfully against PostgreSQL 17, including post-restore db:verify

## Phase 8 — Production
- Container images — production Docker image hardened with non-root runtime, readiness healthcheck, and GHCR CI build/publish workflow
- VPS — production Docker Compose deployment contract added; host deployment remains an external operational step
- PostgreSQL — PostgreSQL 17 production service isolated on an internal Docker network with persistent volume and healthcheck
- Reverse proxy/TLS — Caddy HTTPS reverse proxy with security headers and automatic certificate lifecycle; configuration validated in CI
- Backups — controlled backup/restore scripts plus PostgreSQL 17 CI round-trip verification
- Monitoring — /health and /ready endpoints wired to container healthchecks and documented external monitoring contract
- CI/CD — production Compose/Caddy validation and container build verified in CI
- Production authentication gate — startup now fails closed when the provider-neutral authentication adapter is still unconfigured; a real provider adapter remains required before live deployment
