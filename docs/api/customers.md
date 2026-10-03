# Customers API

Base path: `/api/v1`.

The customer endpoints are authenticated and authorization is enforced server-side.

## Authentication

Send a bearer credential:

```http
Authorization: Bearer <credential>
```

The API delegates credential verification to the configured authentication adapter. The current server wiring intentionally fails closed until a real provider adapter is configured.

## GET /customers

Required permission: `customers.read`.

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "individual",
      "displayName": "Example Customer",
      "phone": null,
      "email": null,
      "notes": null,
      "status": "active",
      "createdAt": "2026-10-02T00:00:00.000Z",
      "updatedAt": "2026-10-02T00:00:00.000Z"
    }
  ]
}
```

## POST /customers

Required permission: `customers.write`.

The request must include an `Idempotency-Key` header containing a stable key of at least 16 characters.

Request:

```json
{
  "type": "business",
  "displayName": "Example Customer",
  "phone": "+963...",
  "email": "customer@example.com",
  "notes": "Optional"
}
```

A successful create is atomic: customer creation, audit event, and idempotency completion are committed in one PostgreSQL transaction. Repeating the same key with the same request payload replays the original response. Reusing a key with a different payload returns a conflict.

## Authorization

The API does not trust client-supplied roles or permissions. The authenticated identity is resolved through `auth_identities`, then roles and permissions are loaded from the database.

## Error contract

Validation errors return `400`, missing/invalid authentication returns `401`, authorization failures return `403`, idempotency conflicts return `409`, and unexpected failures return `500`.

Financial rules do not belong in this HTTP layer; future sales, invoices, payments, and accounting flows must use the same application/transaction boundaries.
