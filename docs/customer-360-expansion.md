# HO Network — Customer 360 Expansion

## Purpose

This document defines the server-side expansion required before the Customers module can be presented as a full Customer 360 experience.

The current foundation Customer resource remains valid and must not be broken:
- id
- type
- displayName
- phone
- email
- notes
- status
- createdAt
- updatedAt

The expansion is additive unless a separately reviewed migration changes an existing contract.

## Domain role

HO Network is a media-buyer operations platform. A customer is therefore more than a sales contact.

The target relationship is:
Customer -> Media Agreement -> Campaign -> Advertising Platform / Ad Account -> Planned Advertising Budget -> Actual Advertising Spend

The customer also anchors operational and financial history:
Customer -> Sales Orders -> Invoices -> Receivables -> Payments -> Delivery Orders -> Accounting dimensions / posted financial history

These relationships must remain server-authoritative.

## Customer 360 resources

### Profile
The customer profile remains the root resource.

Required conceptual attributes:
- customer identity and type
- display name
- status
- email
- notes
- business information where applicable

The existing single phone field is retained for compatibility while the new phone resource becomes the source for multiple numbers.

### Phones
A customer may have multiple phone records.
- customerId
- phone number
- label
- primary flag
- optional notes
- created/updated timestamps

The server must enforce customer ownership and at most one primary phone per customer.

### Addresses
A customer may have multiple addresses/residence records.
- customerId
- label
- address components
- primary flag
- optional notes
- created/updated timestamps

Do not overload the existing notes field with structured address data.

### Social accounts
A customer may have multiple social-account records.
- customerId
- platform
- handle/account identifier
- profile URL where applicable
- primary flag
- optional notes
- created/updated timestamps

Initial supported platforms may include Facebook, Instagram, Telegram, TikTok and WhatsApp, but the database model should remain extensible.

### Documents
Documents require a separate storage decision before implementation.
The customer domain should store document metadata and references, not binary content directly in the customer row.

The provider-neutral storage contract is now documented in `docs/storage-document-contract.md`. It defines the required lifecycle, private object access, server-generated object references, metadata, upload/download authorization, retention, and validation boundaries.

The current foundation still has no storage provider, upload service, or object-access capability. Therefore document tables, upload endpoints, download endpoints, and frontend document UI remain intentionally blocked until that storage capability is reviewed and implemented.

## Media agreements

The first server-side Media Agreement slice is now implemented as an independent resource with persistence, validation, customer/currency checks, audit events, pagination, and API read/create operations. It is intentionally not yet mandatory on campaigns.
A media agreement belongs to a customer and defines the commercial relationship used by campaigns.

Conceptual fields:
- customerId
- agreement number
- start/end dates
- status
- client price
- advertising budget
- management component
- currency
- payment terms
- accounting policy
- notes

Amounts must remain decimal-safe strings at the API boundary.

An agreement must not silently become an accounting journal or receivable record. Financial posting remains governed by the existing accounting domain.

## Campaign relationship
The existing campaign model already references customerId and contains gross amount, planned ad spend, management fee, currency, lifecycle status, dates, spend entries, and invoice links.

A future agreement integration must be designed so that agreement commercial terms and campaign execution values do not create two competing sources of truth.

Before adding a mandatory agreementId to campaigns, existing campaign behavior and migration compatibility must be reviewed.

## Advertising spend
Actual advertising spend is a financial/operational record and is not a mutable customer attribute.

The existing campaign spend model is append-oriented and has reversal support.

The UI must distinguish planned advertising budget, recorded actual spend, reversed spend, and customer accounting balance.

These values must never be collapsed into a single customer balance.

## Timeline
A Customer 360 timeline should be derived from authoritative server records.

It may aggregate customer changes, agreements, campaigns, sales orders, invoices, payments, delivery events, and relevant audit events.

The frontend must not manufacture timeline events from local UI actions.

## Authorization
Customer 360 endpoints must preserve the existing permission model.
- customers.read for customer read operations
- customers.write for customer mutations

Nested resources must also enforce customer/resource ownership and any domain-specific permissions.
A frontend visibility check is not authorization.

## Mutation safety
All new /api/v1 mutating endpoints must follow the existing transport contract:
- authenticated principal
- permission enforcement
- server-side Zod validation
- Idempotency-Key
- transaction where multiple records must change atomically
- audit event for consequential mutations
- API error envelope
- no client-side business-rule authority

## Migration strategy
1. Add normalized customer profile child tables.
2. Add server schemas and service functions.
3. Add read endpoints for Customer 360.
4. Add mutation endpoints with idempotency and audit behavior.
5. Add integration/database tests.
6. Update OpenAPI.
7. Update the Lovable handoff.
8. Only then expand the frontend Customer section.

Existing customer, campaign, invoice, payment and accounting records must remain compatible throughout the migration.

## Explicit non-goals
- client-side financial calculations
- deletion of financial records
- direct browser database access
- persistent bearer-token storage
- API-response offline caching
- inventing document storage behavior
- replacing existing campaign financial semantics
- introducing an agreementId into campaigns without a reviewed migration

## Exit criteria
Customer 360 backend work is complete only when database migrations pass verification, normalized customer resources are API-accessible, authorization tests pass, idempotency tests pass for mutations, audit behavior is verified, OpenAPI matches implemented routes, existing customer/campaign/invoice/payment flows remain green, and the frontend can consume the new resources without duplicating domain logic.