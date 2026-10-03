import { Pool } from "pg";
import { migrateDatabase } from "./migrate.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

await migrateDatabase();

const pool = new Pool({ connectionString: databaseUrl });

try {
  const first = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM schema_migrations"
  );
  const expectedMigrations = 20;
  if (Number(first.rows[0]?.count) !== expectedMigrations) {
    throw new Error(
      `Expected ${expectedMigrations} migrations, found ${first.rows[0]?.count ?? "none"}`
    );
  }

  const requiredTables = [
    "currencies",
    "users",
    "roles",
    "permissions",
    "customers",
    "catalog_items",
    "sales_orders",
    "sales_order_lines",
    "invoices",
    "invoice_lines",
    "payments",
    "payment_allocations",
    "payment_allocation_reversals",
    "driver_collection_sessions",
    "driver_collection_payments",
    "driver_collection_settlement_counts",
    "audit_events",
    "idempotency_keys",
    "exchange_rates",
    "delivery_orders",
    "delivery_order_payments",
    "campaigns",
    "campaign_invoices",
    "campaign_spend_entries",
    "employee_compensation_rules",
    "employee_tasks",
    "expenses",
    "accounting_periods",
    "chart_of_accounts",
    "journal_entries",
    "journal_lines"
  ];

  const tableResult = await pool.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [requiredTables]
  );

  const found = new Set(tableResult.rows.map((row) => row.table_name));
  const missing = requiredTables.filter((table) => !found.has(table));
  if (missing.length > 0) {
    throw new Error(`Missing required tables: ${missing.join(", ")}`);
  }

  const currencyResult = await pool.query<{ code: string }>(
    "SELECT code FROM currencies WHERE code IN ('USD', 'SYP') ORDER BY code"
  );
  const currencies = currencyResult.rows.map((row) => row.code);
  if (currencies.join(",") !== "SYP,USD") {
    throw new Error(`Unexpected seeded currencies: ${currencies.join(", ")}`);
  }

  const requiredTriggers = [
    "payments_financial_immutable",
    "invoices_financial_immutable",
    "expenses_financial_immutable",
    "payment_allocations_financial_immutable",
    "payment_allocation_reversals_financial_immutable",
    "campaign_spend_financial_immutable",
    "employee_tasks_completion_immutable",
    "journal_entries_immutable",
    "journal_lines_immutable"
  ];

  const triggerResult = await pool.query<{ trigger_name: string }>(
    `
      SELECT trigger_name
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
        AND trigger_name = ANY($1::text[])
    `,
    [requiredTriggers]
  );
  const foundTriggers = new Set(triggerResult.rows.map((row) => row.trigger_name));
  const missingTriggers = requiredTriggers.filter((trigger) => !foundTriggers.has(trigger));
  if (missingTriggers.length > 0) {
    throw new Error(`Missing financial immutability triggers: ${missingTriggers.join(", ")}`);
  }

  const requiredAccounts = [
    "1000", "1010", "1100", "1200", "1300", "2000", "2100", "2200",
    "2300", "3000", "4000", "4100", "4200", "5000", "5100", "5200", "5300"
  ];
  const accountResult = await pool.query<{ code: string }>(
    "SELECT code FROM chart_of_accounts WHERE code = ANY($1::text[])",
    [requiredAccounts]
  );
  const foundAccounts = new Set(accountResult.rows.map((row) => row.code));
  const missingAccounts = requiredAccounts.filter((code) => !foundAccounts.has(code));
  if (missingAccounts.length > 0) {
    throw new Error(`Missing seeded chart-of-accounts entries: ${missingAccounts.join(", ")}`);
  }

  await migrateDatabase();

  const second = await pool.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM schema_migrations"
  );
  if (second.rows[0]?.count !== String(expectedMigrations)) {
    throw new Error("Migration rerun changed the applied migration count");
  }

  console.log("Database migration verification passed.");
} finally {
  await pool.end();
}
