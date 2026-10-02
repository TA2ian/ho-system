# Payments and Receivable Allocations

Payments are recorded independently from invoices. A payment may remain unallocated or be explicitly allocated to one or more issued invoices.

Endpoints:

- `POST /api/v1/payments` — record a payment.
- `GET /api/v1/payments/:id` — retrieve a payment and its allocations.
- `POST /api/v1/payments/:id/allocate` — allocate part of a payment to an issued invoice.

Payment recording and allocation require `payments.manage` and an `Idempotency-Key`. Reads require `payments.read`.

Supported methods in this slice are `cash` and `sham_cash`. The currency is explicit and currently may be USD or SYP through the currency foreign key. No Sham Cash API integration is assumed; the transaction is recorded from the operational receipt.

Allocation is transaction-safe. The payment row and target invoice row are locked before remaining balances are calculated. A payment cannot be allocated beyond its remaining unallocated amount, and an invoice cannot be allocated beyond its outstanding amount. Payment and invoice currencies must match in this version; cross-currency settlement will require an explicit exchange-rate snapshot and is intentionally not inferred.

There is no editable outstanding-balance field. Invoice outstanding is derived from the issued invoice total minus posted payment allocations. Voiding payments and reversing allocations are separate controlled transitions and are not implemented by editing historical rows.

Driver collection and settlement will build on the same payment records rather than creating a second financial representation.
