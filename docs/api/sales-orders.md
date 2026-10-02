# Sales Orders API

`POST /api/v1/sales-orders` requires `sales.manage` and an `Idempotency-Key`.

A sales order starts as `draft`. The order lines snapshot the catalog item's unit cost, sale price, unit, description, and currency at creation time. Later catalog price changes therefore do not mutate the historical order.

The order is not an accounting posting. Invoice creation, receivable recognition, payment allocation, and ledger posting remain separate financial transitions.

The request currency must match every selected catalog item's currency. Quantities and prices use decimal-safe values rather than JavaScript floating-point arithmetic.
