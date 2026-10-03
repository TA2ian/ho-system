# HO Network — Lovable Customer 360 Implementation Handoff

## 1. Purpose

This is the implementation bridge between the authoritative backend on `foundation/v1` and the Lovable frontend.

Lovable must implement only the API-backed surface listed here. Do not infer missing Customer 360 capabilities from the long-term product vision.

Source of truth order:

1. Server behavior and authorization
2. `docs/openapi.yaml`
3. `docs/api-contract.md`
4. This handoff
5. Existing frontend UX conventions

If this document conflicts with server behavior or the API contract, stop and resolve the contract mismatch rather than inventing a client-side rule.

## 2. Current Customer 360 backend surface

Implemented and frontend-consumable:

- Customer root detail
- Multiple phone records
- Multiple address records
- Multiple social-account records
- Business profile for business customers
- Media Agreements
- Existing customer list/create flow

Not implemented and must remain unavailable in the UI:

- Customer documents/uploads/downloads
- Unified Customer 360 timeline
- Customer financial aggregate/balance endpoint
- Delivery history aggregate
- Campaign-to-agreement integration
- Any client-side financial calculation

## 3. Customer routes

### Root customer

`GET /api/v1/customers/{customerId}`

Permission: `customers.read`

Response:

`{ data: Customer }`

Customer fields currently include:

- `id`
- `type`: `individual | business`
- `displayName`
- `phone` (legacy/root compatibility field)
- `email`
- `notes`
- `status`
- `createdAt`
- `updatedAt`

Use this endpoint when opening/reloading a customer detail route. Do not treat the Customers list row as the permanent detail source.

### Phones

`GET /api/v1/customers/{customerId}/phones?limit=&offset=`

Permission: `customers.read`

`POST /api/v1/customers/{customerId}/phones`

Permission: `customers.write`

POST body:

- `phone`: string, 3–50
- `label`: nullable string, max 100
- `isPrimary`: boolean, optional
- `notes`: nullable string, max 2000

The server enforces unique phone identity per customer and at most one primary phone.

### Addresses

`GET /api/v1/customers/{customerId}/addresses?limit=&offset=`

Permission: `customers.read`

`POST /api/v1/customers/{customerId}/addresses`

Permission: `customers.write`

POST body:

- `label`: nullable string, max 100
- `addressLine1`: required string
- `addressLine2`: nullable string, max 255
- `city`: nullable string, max 120
- `region`: nullable string, max 120
- `postalCode`: nullable string, max 40
- `countryCode`: nullable ISO-like two-letter uppercase code
- `isPrimary`: boolean, optional
- `notes`: nullable string, max 2000

The server enforces at most one primary address.

### Social accounts

`GET /api/v1/customers/{customerId}/social-accounts?limit=&offset=`

Permission: `customers.read`

`POST /api/v1/customers/{customerId}/social-accounts`

Permission: `customers.write`

POST body:

- `platform`: required string, max 50
- `accountIdentifier`: required string, max 255
- `profileUrl`: nullable URL, max 2048
- `isPrimary`: boolean, optional
- `notes`: nullable string, max 2000

The server normalizes platform identifiers to lowercase and enforces unique identity per customer/platform/account identifier and at most one primary account per customer/platform.

## 4. Business profile

Only customers whose root `type` is `business` may use this resource.

`GET /api/v1/customers/{customerId}/business-profile`

Permission: `customers.read`

`PUT /api/v1/customers/{customerId}/business-profile`

Permission: `customers.write`

PUT requires `Idempotency-Key`.

Body:

- `legalName`
- `registrationNumber`
- `taxNumber`
- `industry`
- `website`
- `notes`

All are nullable/optional strings subject to server validation.

For an individual customer, do not render an editable business-profile section.

## 5. Media Agreements

List:

`GET /api/v1/media-agreements?customerId={uuid}&limit=&offset=`

Permission: `customers.read`

Detail:

`GET /api/v1/media-agreements/{id}`

Permission: `customers.read`

Create:

`POST /api/v1/media-agreements`

Permission: `customers.write`

POST requires `Idempotency-Key`.

Body:

- `customerId`
- `agreementNumber`
- `startsOn`
- `endsOn`
- `status`: `draft | active | suspended | expired | terminated`
- `clientPrice`
- `advertisingBudget`
- `managementComponent`
- `currencyCode`
- `paymentTerms`
- `accountingPolicy`
- `notes`

All monetary fields are decimal strings. Never parse them into JavaScript Number for authoritative calculations.

The server validates active customer and active currency and enforces unique agreement number.

Campaigns do not currently require an `agreementId`. Do not add that field in the frontend.

## 6. Required Customer detail UX

Create a customer detail experience that can be reached from the Customers list.

Minimum sections:

1. Overview
2. Contact information
3. Addresses
4. Social accounts
5. Business information — business customers only
6. Media Agreements

The detail screen must load each section from the corresponding API contract.

Do not build a giant client-side aggregate object and do not fabricate a unified timeline.

A section may show an explicit "not available yet" placeholder only for capabilities listed as not implemented in this handoff.

## 7. Mutation behavior

All POST mutations require a valid `Idempotency-Key`.

The existing `apps/web/src/api/client.ts` is the only transport abstraction.

The client now supports:

- GET
- POST with Idempotency-Key
- PUT with Idempotency-Key

Do not create another fetch/axios wrapper.

Generate a fresh sufficiently long idempotency key for each new mutation attempt. While a mutation is pending, disable duplicate submission.

After success, use the returned server data and/or reload the affected resource. Do not manufacture success state locally.

## 8. Error and permission states

Every Customer 360 section must distinguish:

- loading
- loaded
- empty
- validation error
- permission denied
- session expired
- API/business-rule error
- mutation pending
- mutation failure

A failed request must not be represented as an empty list.

If the server returns a permission error, do not bypass it by hiding the request behind a different client path.

## 9. Pagination

Use the standard v1 pagination contract:

- default limit: 50
- maximum limit: 200
- offset: 0 or greater
- response: `{ data: [], meta: { limit, offset, hasMore } }`

For Customer 360 child lists, use pagination rather than loading an unbounded collection.

## 10. Financial safety boundary

Customer 360 is not a financial calculation surface.

Do not calculate:

- customer accounting balance
- receivable balance
- campaign budget balance
- actual advertising spend
- payment allocation totals
- accounting totals

Those values are server-authoritative and are intentionally not exposed as a Customer 360 aggregate by this handoff.

Do not add fake KPI cards to the customer detail page.

## 11. Documents boundary

Do not implement document upload, document download, document previews, document deletion, or document metadata UI yet.

The storage contract exists as architecture documentation, but the project does not yet have a private storage provider/access capability.

## 12. Timeline boundary

Do not construct a Customer 360 timeline by combining timestamps from the browser or by synthesizing events from UI actions.

A unified timeline will be added only after its authorization and server aggregation contract is explicitly implemented.

## 13. Acceptance checklist

The Customer 360 frontend section is considered integrated only when:

- Customer list remains functional.
- A customer can open a detail route using the authoritative customer ID.
- Reloading the detail route still loads the customer from the API.
- Phones, addresses, and social accounts use their dedicated endpoints.
- Business profile appears only for business customers.
- Media Agreements can be listed per customer.
- Mutations use the shared API client and Idempotency-Key.
- No bearer token is persisted.
- No API/financial data is cached offline.
- No financial totals are calculated in React.
- Permission/session/API failures have explicit UI states.
- Mobile and desktop layouts are usable.
- RTL semantics remain correct.
- Typecheck/build/test remain green.

## 14. Verification protocol

Do not report "Customer 360 implemented" merely because the UI compiles.

Verification must compare:

`Lovable UI -> API client -> OpenAPI -> app.ts -> application service -> database schema/migration`

Any route, field, permission, mutation, or lifecycle mismatch blocks acceptance until resolved.

The backend remains authoritative.
