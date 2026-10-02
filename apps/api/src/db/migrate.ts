import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { createDatabase, closeDatabase } from "./client.js";

const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../migrations"
);

function checksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", ["ho-network:migrations"]);

    await client.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())"
    );

    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = await readFile(join(migrationsDirectory, file), "utf8");
      const version = file.slice(0, -4);
      const digest = checksum(sql);

      const existing = await client.query<{ checksum: string }>(
        "SELECT checksum FROM schema_migrations WHERE version = $1",
        [version]
      );

      if (existing.rowCount) {
        if (existing.rows[0]?.checksum !== digest) {
          throw new Error(`Migration checksum mismatch: ${version}`);
        }
        continue;
      }

      await client.query("BEGIN");

      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
          [version, digest]
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["ho-network:migrations"]);
    client.release();
  }
}

export async function migrateDatabase(): Promise<void> {
  const { pool } = createDatabase();
  try {
    await runMigrations(pool);
  } finally {
    await closeDatabase(pool);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await migrateDatabase();
}
