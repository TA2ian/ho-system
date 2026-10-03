import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { allSchema } from "./client.js";
import { beginIdempotency, completeIdempotency } from "../application/idempotency.js";
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
  const expectedMigrations = 26;
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
    "campaign_spend_reversals",
    "employee_compensation_rules",
    "employee_tasks",
    "expenses",
    "accounting_periods",
    "chart_of_accounts",
    "journal_entries",
    "journal_lines",
    "customer_phones",
    "customer_addresses",
    "customer_social_accounts",
    "media_agreements",
    "customer_business_profiles"
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
    "campaign_spend_reversals_financial_immutable",
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

  const exclusionResult = await pool.query<{ constraint_name: string }>(
    `
      SELECT con.conname AS constraint_name
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'accounting_periods'
        AND con.contype = 'x'
        AND con.conname = 'accounting_periods_date_range_excl'
    `
  );
  if (exclusionResult.rowCount !== 1) {
    throw new Error("Missing accounting period non-overlap exclusion constraint");
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

  const indexResult = await pool.query<{ indexname: string }>(
    `
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'driver_collection_sessions'
        AND indexname = 'driver_collection_open_driver_uq'
    `
  );
  if (indexResult.rowCount !== 1) {
    throw new Error("Missing unique open driver collection index");
  }

  const driverId = randomUUID();
  const firstSessionId = randomUUID();
  const secondSessionId = randomUUID();
  await pool.query(
    "INSERT INTO users (id, display_name, status) VALUES ($1, $2, 'active')",
    [driverId, "Concurrency verification driver"]
  );

  const firstClient = await pool.connect();
  const secondClient = await pool.connect();

  try {
    await firstClient.query("BEGIN");
    await secondClient.query("BEGIN");
    await firstClient.query(
      "INSERT INTO driver_collection_sessions (id, driver_user_id, status, opened_by) VALUES ($1, $2, 'open', $2)",
      [firstSessionId, driverId]
    );

    const secondInsert = secondClient.query(
      "INSERT INTO driver_collection_sessions (id, driver_user_id, status, opened_by) VALUES ($1, $2, 'open', $2)",
      [secondSessionId, driverId]
    );

    await firstClient.query("COMMIT");

    try {
      await secondInsert;
      throw new Error("Expected concurrent duplicate open-session insert to fail");
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        (error as { code?: string }).code !== "23505"
      ) {
        throw error;
      }
    }

    await secondClient.query("ROLLBACK");
  } finally {
    firstClient.release();
    secondClient.release();
    await pool.query(
      "DELETE FROM driver_collection_sessions WHERE id IN ($1, $2)",
      [firstSessionId, secondSessionId]
    );
    await pool.query("DELETE FROM users WHERE id = $1", [driverId]);
  }

  const raceScope = `integration:idempotency-race:${randomUUID()}`;
  const raceKey = `race-key-${randomUUID()}`;
  const raceHash = "race-request-hash";
  const raceFirstClient = await pool.connect();
  const raceSecondClient = await pool.connect();

  try {
    await raceFirstClient.query("BEGIN");
    await raceSecondClient.query("BEGIN");

    const raceFirstDb = drizzle(raceFirstClient, { schema: allSchema });
    const raceSecondDb = drizzle(raceSecondClient, { schema: allSchema });

    const raceFirst = await beginIdempotency(raceFirstDb, raceScope, raceKey, raceHash);
    if (raceFirst.kind !== "new") {
      throw new Error(`Expected first concurrent idempotency attempt to be new, got ${raceFirst.kind}`);
    }

    const secondAttempt = beginIdempotency(raceSecondDb, raceScope, raceKey, raceHash);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await raceFirstClient.query("COMMIT");

    const raceSecond = await secondAttempt;
    if (raceSecond.kind !== "conflict" || raceSecond.reason !== "IN_PROGRESS") {
      throw new Error("Expected concurrent duplicate idempotency attempt to be rejected as IN_PROGRESS");
    }

    await raceSecondClient.query("ROLLBACK");
  } finally {
    raceFirstClient.release();
    raceSecondClient.release();
    await pool.query(
      "DELETE FROM idempotency_keys WHERE scope = $1 AND idempotency_key = $2",
      [raceScope, raceKey]
    );
  }

  const idempotencyDb = drizzle(pool, { schema: allSchema });
  const idempotencyScope = `integration:idempotency:${randomUUID()}`;
  const idempotencyKey = `integration-key-${randomUUID()}`;
  const requestHash = "integration-request-hash";

  const firstIdempotency = await beginIdempotency(
    idempotencyDb,
    idempotencyScope,
    idempotencyKey,
    requestHash
  );
  if (firstIdempotency.kind !== "new") {
    throw new Error(`Expected first idempotency attempt to be new, got ${firstIdempotency.kind}`);
  }

  const inProgress = await beginIdempotency(
    idempotencyDb,
    idempotencyScope,
    idempotencyKey,
    requestHash
  );
  if (inProgress.kind !== "conflict" || inProgress.reason !== "IN_PROGRESS") {
    throw new Error("Expected repeated in-progress idempotency request to be rejected");
  }

  await completeIdempotency(idempotencyDb, firstIdempotency.id, 201, {
    data: { verification: "ok" }
  });

  const replay = await beginIdempotency(
    idempotencyDb,
    idempotencyScope,
    idempotencyKey,
    requestHash
  );
  if (
    replay.kind !== "replay" ||
    replay.status !== 201 ||
    JSON.stringify(replay.body) !== JSON.stringify({ data: { verification: "ok" } })
  ) {
    throw new Error("Expected completed idempotency request to replay its stored response");
  }

  const reusedWithDifferentBody = await beginIdempotency(
    idempotencyDb,
    idempotencyScope,
    idempotencyKey,
    "different-request-hash"
  );
  if (reusedWithDifferentBody.kind !== "conflict" || reusedWithDifferentBody.reason !== "KEY_REUSED") {
    throw new Error("Expected idempotency key reuse with a different request hash to be rejected");
  }

  await pool.query(
    "DELETE FROM idempotency_keys WHERE scope = $1 AND idempotency_key = $2",
    [idempotencyScope, idempotencyKey]
  );

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
