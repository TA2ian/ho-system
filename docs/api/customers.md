# Customer API Contract

Base path: `/api/v1`

## List customers

`GET /customers`

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "type": "individual",
      "displayName": "string",
      "phone": "string|null",
      "email": "string|null",
      "notes": "string|null",
      "status": "active",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  ]
}
```

## Create customer

`POST /customers`

Request:

```json
{
  "type": "individual|business",
  "displayName": "string",
  "phone": "string|null",
  "email": "string|null",
  "notes": "string|null"
}
```

The API validates input server-side. Financial or authorization decisions must never be delegated to the frontend.

## Frontend requirement

The frontend may use these contracts directly. Lovable should treat the API as an external backend and must not create parallel business rules or duplicate customer persistence logic.
