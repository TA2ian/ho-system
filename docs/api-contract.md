# API Contract — foundation/v1

## Scope

The foundation/v1 transport contract is represented by `docs/openapi.yaml`. The application Zod schemas remain authoritative for request payload validation until schema generation is introduced.

## Authentication and authorization

All `/api/v1/*` routes require an authenticated principal. Route handlers enforce domain permissions with `assertPermission`. Health endpoints `/health` and `/ready` are intentionally outside the v1 bearer-authenticated surface.

## Response envelope

Successful API responses use `{ data }`. Paginated list responses use `{ data: [], meta: { limit, offset, hasMore } }`.

Pagination applies to all v1 list endpoints. `limit` defaults to 50 and is capped at 200. `offset` defaults to 0 and is capped at 100000. Invalid pagination values return `400` with `PAGINATION_INVALID`.

## Errors

The transport error envelope is `{ error, message }`. Validation responses may also include `issues`; rate limiting may include `retryAfterSeconds`.

The application uses stable domain/application error codes through `ApplicationError`. Fastify transport failures are normalized to the same envelope, including invalid JSON, oversized bodies, unknown routes, and validation errors.

## Idempotency

All mutating `/api/v1` POST operations require `Idempotency-Key` with 16–255 characters. Keys are scoped to the authenticated principal and operation/resource where applicable. Reusing a key with a different request payload returns `409 IDEMPOTENCY_KEY_REUSED`; an in-progress duplicate returns `409 IDEMPOTENCY_IN_PROGRESS`.

## Financial data

Financial report amounts and persisted accounting amounts remain decimal strings. API clients must not coerce monetary values to binary floating-point numbers.

## Versioning rule

Changes to `/api/v1` behavior must update the OpenAPI contract and this document in the same change. Breaking transport changes require a new API version rather than silently changing the existing v1 contract.

## Customer root detail

The customer root resource is available for Customer 360 navigation and reload-safe detail views:

- `GET /api/v1/customers/{customerId}`
- Requires `customers.read`
- Returns the authoritative customer row in the standard `{ data }` envelope
- Invalid UUID returns `400 CUSTOMER_ID_INVALID`; missing customer returns `404 CUSTOMER_NOT_FOUND`

The frontend must use this endpoint for a customer detail route instead of relying on list-page state as the source of truth.

## Customer 360 contact resources

Customer contact extensions are server-authoritative child resources. They require `customers.read` for reads and `customers.write` for mutations.

- `/api/v1/customers/{customerId}/phones`
- `/api/v1/customers/{customerId}/addresses`
- `/api/v1/customers/{customerId}/social-accounts`

Their POST operations require the standard `Idempotency-Key` contract and record audit events. Pagination uses the standard v1 pagination contract.

## Media Agreements

Media Agreements are an independent Customer 360 resource:

- `GET /api/v1/media-agreements`
- `GET /api/v1/media-agreements/{id}`
- `POST /api/v1/media-agreements`

They require `customers.read` for reads and `customers.write` for creation. Monetary fields are decimal strings. Creation validates the referenced active customer and currency and records an audit event.

Campaigns are not yet required to reference a Media Agreement. This remains a separate domain-integration decision until the campaign contract is explicitly expanded.


Customer business profiles are available for customers whose type is `business`:

- `GET /api/v1/customers/{customerId}/business-profile`
- `PUT /api/v1/customers/{customerId}/business-profile`

The write operation uses `Idempotency-Key`, validates the customer type server-side, and records an audit event.
