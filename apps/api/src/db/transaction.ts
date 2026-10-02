import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool, PoolClient } from "pg";
import type { Database } from "./client.js";
import { allSchema } from "./client.js";

export type TransactionDatabase = Database;

export async function withTransaction<T>(
  pool: Pool,
  callback: (tx: TransactionDatabase) => Promise<T>
): Promise<T> {
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");
    const tx = drizzle(client, { schema: allSchema }) as TransactionDatabase;
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
