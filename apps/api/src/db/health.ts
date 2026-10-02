import { sql } from "drizzle-orm";
import type { Database } from "./client.js";

export async function checkDatabaseHealth(db: Database): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
