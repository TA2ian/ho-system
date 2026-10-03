import { randomUUID } from "node:crypto";
import type { Database } from "../db/client.js";
import { auditEvents } from "../db/schema.js";

export async function recordAuditEvent(
  db: Database,
  input: {
    actorId: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    requestId: string | null;
    idempotencyKey: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await db.insert(auditEvents).values({
    id: randomUUID(),
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    requestId: input.requestId,
    idempotencyKey: input.idempotencyKey,
    metadata: input.metadata ?? null
  });
}
