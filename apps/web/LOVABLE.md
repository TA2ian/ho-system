# Lovable implementation entry point

For the current Customer 360 implementation, start with:

`docs/lovable-customer-360-handoff.md`

Then verify against:

1. `docs/openapi.yaml`
2. `docs/api-contract.md`
3. `apps/api/src/app.ts`
4. `apps/api/src/application/customers/`
5. `apps/api/src/application/media-agreements/`
6. `apps/web/src/api/client.ts`

Do not implement Customer 360 from an older prompt or from the long-term product vision alone.

Current frontend-ready Customer 360 resources:

- Customer detail
- Phones
- Addresses
- Social accounts
- Business profile
- Media Agreements

Still blocked:

- Documents
- Unified timeline
- Financial aggregate/balance
- Campaign agreement integration

The backend is authoritative. Any route, field, permission, idempotency, validation, or financial behavior not present in the referenced contract must not be invented in the UI.

Acceptance requires verification of the implementation against the backend contract and green CI.
