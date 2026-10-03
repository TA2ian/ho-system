# Accounting Domain — Initial Contract

The system is an accounting/management application, so the financial model is based on explicit documents and auditable state transitions rather than mutable balances.

## Monetary representation

All persisted monetary values use PostgreSQL NUMERIC with an explicit scale appropriate to the currency. Application code must convert database values into a decimal-safe representation before arithmetic. JavaScript Number is not used for financial calculations.

Every monetary value has an explicit currency where multi-currency data is possible.

## Documents

Operational documents include:

- Sales order
- Invoice
- Payment
- Credit/reversal document

A document has a lifecycle. Posting a financial document is a state transition, not a field edit.

## General ledger

The general ledger uses double-entry journal entries:

- One journal entry contains one or more journal lines.
- Total debits must equal total credits.
- A posted journal entry is immutable.
- Corrections are made through reversal/correction entries.
- Journal entries reference their source document where applicable.
- Posting occurs inside the same database transaction as the source financial state transition.

## Receivables

An invoice may create an accounts-receivable balance.

Payments are allocated explicitly to receivables. Outstanding balance is derived from posted financial events rather than maintained as an independently editable number.

## Periods

Accounting periods can be opened and closed.

A closed period cannot receive normal postings. Corrections to historical periods follow an explicit controlled procedure.

## Audit

Audit records capture:

- actor
- action
- resource type
- resource id
- timestamp
- request/idempotency correlation
- relevant before/after metadata where appropriate

Audit records are append-only.

## Idempotency

Every externally callable financial command that can create or post financial state accepts an idempotency key.

The key is scoped to the authenticated actor and operation semantics. Replaying the same logical command returns the original result instead of creating duplicate financial effects.

## Concurrency

Critical state transitions use database transactions and row-level locking or equivalent optimistic concurrency controls.

Examples:

- posting an invoice
- allocating a payment
- closing a period
- changing a document from draft to posted

The application must not rely on UI state to prevent double submission or concurrent modification.
