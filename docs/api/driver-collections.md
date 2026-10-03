# Driver Collections API

Driver collection is a settlement workflow around the existing payment records. The payment is the financial source of truth; the collection session only groups payments received by a driver and records the manual closing count.

## Endpoints

- `POST /api/v1/driver-collections`
  - Opens one collection session for the authenticated driver.
  - Requires `collections.manage`.
  - A driver cannot open a second session while one is open.

- `GET /api/v1/driver-collections/:id`
  - Returns the session, linked payments, and settlement rows.
  - Drivers can read their own sessions. Authorized back-office roles can read other sessions.

- `POST /api/v1/driver-collections/:id/payments`
  - Records a cash or Sham Cash payment and links it to the open session atomically.
  - The payment is created through the normal payment service, so payment history and audit rules remain centralized.
  - A closed session cannot receive another payment.

- `POST /api/v1/driver-collections/:id/close`
  - Manually closes the session.
  - Expected amounts are derived from recorded payments grouped by currency and method.
  - The submitted counted amounts are stored together with expected amount and difference.
  - Closing is idempotent and locked against concurrent payment additions.

## Settlement rules

- Supported collection methods are `cash` and `sham_cash`.
- Currency is explicit on every payment; the current seeded currencies are USD and SYP.
- A reversed/voided payment is excluded from the expected closing amount, but remains in the session history.
- Settlement does not edit payment amounts or balances.
- A difference is recorded rather than silently adjusted.
- Financial correction remains an explicit payment reversal; settlement is not an accounting shortcut.

## Authorization

Drivers receive `collections.read` and `collections.manage`, but no longer receive the broad `payments.manage` permission. Payment reversal remains restricted to owner/admin/accountant.
