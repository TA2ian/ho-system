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