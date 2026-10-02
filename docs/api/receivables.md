# Receivables API

Receivables are derived from issued invoices and payment allocation history. The system does not store an editable outstanding-balance field.

For an invoice:

- allocated amount = payment allocations minus allocation reversals;
- outstanding amount = invoice total minus net allocated amount;
- only issued invoices are receivables;
- voided and draft invoices are excluded;
- an over-allocation is treated as an invariant violation rather than silently returning a negative balance.

Endpoints:

- `GET /api/v1/receivables/invoices/:id` — current receivable state for one issued invoice.
- `GET /api/v1/receivables/customers/:customerId` — issued invoices and derived outstanding balances for a customer.

Reads require `receivables.read`.

Payment reversals are reflected automatically because the calculation subtracts reversal rows from historical allocations. The payment and allocation records remain the financial event history; receivables are a derived view over that history.

This layer intentionally does not post general-ledger entries. Ledger posting, invoice voids/credit notes, aging buckets, and reconciliation remain controlled accounting transitions.
