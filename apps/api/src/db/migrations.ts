import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { config } from "../config.js";
import * as schema from "./schema.js";

export async function runMigrations(pool: Pool): Promise<void> {
  const db = drizzle(pool, { schema });
  await db.execute(sql`create extension if not exists pgcrypto`);
  await migrate(db, { migrationsFolder: new URL("../../drizzle", import.meta.url).pathname });
}

void config;
