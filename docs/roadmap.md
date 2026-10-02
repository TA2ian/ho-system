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
- PostgreSQL
- Migration runner
- Database connection lifecycle
- Transaction abstraction
- Base audit/idempotency infrastructure

## Phase 2 — Identity & Access
- Authentication provider boundary
- Users
- Roles
- Permissions
- Resource scopes
- Session/token verification

## Phase 3 — Business domains
- Customers
- Catalog
- Sales orders
- Invoices
- Receivables
- Payments

## Phase 4 — Accounting integrity
- Financial posting rules
- Reversal rules
- Period controls
- Reconciliation
- Reporting read models

## Phase 5 — Arabic PWA
- Preserve Arabic-first UX direction
- RTL
- Responsive layouts
- Offline-safe shell
- API integration

## Phase 6 — Verification
- Unit tests
- Integration tests
- Database tests
- Authorization tests
- Concurrency tests
- Idempotency tests
- Backup/restore verification

## Phase 7 — Production
- Container images
- VPS
- PostgreSQL
- Reverse proxy/TLS
- Backups
- Monitoring
- CI/CD
