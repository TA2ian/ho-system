# Catalog API

The catalog models products, materials, and services using the same item structure while keeping classification flexible.

Each item has:
- a unique code
- a category
- kind: product, material, or service
- unit
- currency
- cost price
- sale price
- deliverable flag

Cost and sale prices are stored as PostgreSQL fixed-precision numeric values and returned as strings. This avoids JavaScript floating-point money errors.

## GET /api/v1/catalog/categories

Requires `catalog.read`.

Returns active catalog categories.

## GET /api/v1/catalog/items

Requires `catalog.read`.

Returns active catalog items.

## POST /api/v1/catalog/items

Requires `catalog.manage` and an `Idempotency-Key` of at least 16 characters.

Example:

```json
{
  "categoryId": "uuid",
  "code": "DELIVERY-BOX-01",
  "name": "صندوق توصيل",
  "description": null,
  "itemKind": "material",
  "unit": "piece",
  "currencyCode": "USD",
  "costPrice": "2.5000000000",
  "salePrice": "4.0000000000",
  "isDeliverable": true
}
```

The service rejects a sale price below cost price. Creation and its audit/idempotency state are committed atomically.

Catalog prices are snapshots of the current catalog state. Future sales documents must snapshot their own unit price and cost at the time of sale; they must not depend on a later catalog-price edit.
