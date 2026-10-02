import type { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import * as schema from "./schema.js";

type Transaction = PgTransaction<
  "async",
  typeof schema,
  Extract<keyof typeof schema, string>
>;

export async function withTransaction<T>(
  pool: Pool,
  callback: (tx: NodePgDatabase<typeof schema> | Transaction) => Promise<T>
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const tx = drizzle(client, { schema });
    const result = await callback(tx);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
