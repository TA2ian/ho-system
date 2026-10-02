import { buildApp } from "./app.js";
import { closeDatabase, createDatabase } from "./db/client.js";
import { config } from "./config.js";

const { db, pool } = createDatabase();
const app = buildApp({ db });

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await closeDatabase(pool);
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({
    host: config.HOST,
    port: config.PORT
  });
} catch (error) {
  app.log.error(error);
  await closeDatabase(pool);
  process.exit(1);
}
