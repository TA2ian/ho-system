import { createHash, randomUUID } from "node:crypto";
import { eq, and, lte } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { idempotencyKeys } from "../db/schema.js";

export type IdempotencyResult =
  | { kind: "new"; id: string }
  | { kind: "replay"; status: number; body: unknown }
  | { kind: "conflict"; reason: "KEY_REUSED" | "IN_PROGRESS" };

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stableSerialize(record[key])}`
  ).join(",")}}`;
}

export function hashRequestBody(body: unknown): string {
  return createHash("sha256").update(stableSerialize(body)).digest("hex");
}

export async function beginIdempotency(
  db: Database,
  scope: string,
  key: string,
  requestHash: string,
  ttlMs = 24 * 60 * 60 * 1000
): Promise<IdempotencyResult> {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + ttlMs);

  await db.delete(idempotencyKeys).where(and(
    eq(idempotencyKeys.scope, scope),
    eq(idempotencyKeys.idempotencyKey, key),
    lte(idempotencyKeys.expiresAt, new Date())
  ));

  await db.insert(idempotencyKeys).values({
    id,
    scope,
    idempotencyKey: key,
    requestHash,
    status: "processing",
    expiresAt
  }).onConflictDoNothing({
    target: [idempotencyKeys.scope, idempotencyKeys.idempotencyKey]
  });

  const [row] = await db.select().from(idempotencyKeys).where(and(
    eq(idempotencyKeys.scope, scope),
    eq(idempotencyKeys.idempotencyKey, key)
  )).limit(1);

  if (!row) throw new Error("IDEMPOTENCY_RECORD_NOT_FOUND");

  if (row.requestHash !== requestHash) {
    return { kind: "conflict", reason: "KEY_REUSED" };
  }

  if (row.status === "completed") {
    if (row.responseStatus === null) throw new Error("IDEMPOTENCY_RESPONSE_INVALID");
    return { kind: "replay", status: row.responseStatus, body: row.responseBody };
  }

  if (row.id !== id) {
    return { kind: "conflict", reason: "IN_PROGRESS" };
  }

  return { kind: "new", id };
}

export async function completeIdempotency(
  db: Database,
  id: string,
  status: number,
  body: unknown
): Promise<void> {
  await db.update(idempotencyKeys)
    .set({
      status: "completed",
      responseStatus: status,
      responseBody: body
    })
    .where(eq(idempotencyKeys.id, id));
}
