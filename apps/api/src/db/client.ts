import { Pool, type PoolConfig } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { config } from "../config.js";
import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

export function createDatabase(): { db: Database; pool: Pool } {
  const poolConfig: PoolConfig = {
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000
  };

  const pool = new Pool(poolConfig);
  const db = drizzle(pool, { schema });

  return { db, pool };
}

export async function closeDatabase(pool: Pool): Promise<void> {
  await pool.end();
}
