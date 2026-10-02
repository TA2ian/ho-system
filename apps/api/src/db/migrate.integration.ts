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
  const expectedMigrations = 10;
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
    "audit_events",
    "idempotency_keys",
    "exchange_rates"
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
