# Sales Orders API

`POST /api/v1/sales-orders` requires `sales.manage` and an `Idempotency-Key`.

A sales order starts as `draft`. The order lines snapshot the catalog item's unit cost, sale price, unit, description, and currency at creation time. Later catalog price changes therefore do not mutate the historical order.

`GET /api/v1/sales-orders/:id` returns the order and its snapshotted lines.

A draft can be moved exactly once to either `confirmed` or `cancelled`:

- `POST /api/v1/sales-orders/:id/confirm` confirms the commercial order.
- `POST /api/v1/sales-orders/:id/cancel` cancels a draft before confirmation.

Both lifecycle commands require `sales.manage` and an `Idempotency-Key`. The transition is executed inside a database transaction and locks the order row before checking its current state. Repeating the same idempotent command replays the stored response; a different request using the same key is rejected.

A confirmed or cancelled order cannot be transitioned again through these endpoints. This deliberately keeps cancellation/reversal semantics separate from future invoice and accounting corrections.

The order is not an accounting posting. Invoice creation, receivable recognition, payment allocation, and ledger posting remain separate financial transitions.

The request currency must match every selected catalog item's currency. Quantities and prices use decimal-safe values rather than JavaScript floating-point arithmetic.
