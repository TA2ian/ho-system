# Invoices and Receivables API

Invoices are financial documents derived from confirmed sales orders. Creating an invoice snapshots the sales-order commercial values into invoice lines. It does not by itself post a general-ledger journal entry.

Endpoints:

- `POST /api/v1/invoices` — create a draft invoice from a confirmed sales order.
- `GET /api/v1/invoices/:id` — retrieve the invoice and its lines.
- `POST /api/v1/invoices/:id/issue` — issue the draft invoice.

Create and issue commands require `invoices.manage` and an `Idempotency-Key`. Reads require `invoices.read`.

Only one invoice may be created from a sales order because `source_sales_order_id` is unique. Repeating invoice creation for the same source order returns the existing invoice rather than creating a duplicate.

An invoice can move from `draft` to `issued` only once. Issuing locks the invoice row in the transaction. An issued invoice is a receivable-generating document at the operational boundary, but this stage deliberately does not create a general-ledger journal entry.

The invoice total is calculated from invoice lines using decimal arithmetic. There is no editable balance field. Payment allocation and outstanding receivable will be introduced as a separate financial transition, with the outstanding amount derived from the invoice total and posted payment allocations.

Voiding, credit notes, payment allocation, accounting periods, and double-entry journal posting remain separate controlled transitions.
