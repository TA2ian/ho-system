Exchange rates and reports\n\nExchange rates are stored as quoted pairs and observed timestamps. The GL stores an explicit transaction-to-base rate snapshot. If the base currency is USD and a USD/SYP quote is stored as SYP per USD, the GL resolver inverts it when converting SYP to USD.\n\nReports read posted journal entries only. Trial balance and account ledger do not derive balances from operational tables.

Operational reconciliation

GET /api/v1/accounting/reconciliation?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD compares expected accounting postings for issued/voided invoices, payments, payment allocations, campaign spend, recorded/voided expenses, and completed employee tasks against posted journal entries. It also checks that voided/reversed operational records have a posted reversal entry. The report is read-only and does not mutate operational or accounting records.
## Financial statement read models

The API exposes frontend-ready financial statement read models sourced only from posted journal entries:

- `GET /api/v1/accounting/reports/income-statement?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/v1/accounting/reports/balance-sheet?asOfDate=YYYY-MM-DD`

Amounts are returned as decimal strings. The balance sheet includes `balanceCheck`; zero indicates that assets equal liabilities plus equity including current-period net income.

The complete foundation/v1 transport contract is captured in `docs/openapi.yaml`. Payload schemas remain authoritative in the application's Zod input schemas until a generated schema pipeline is introduced.
