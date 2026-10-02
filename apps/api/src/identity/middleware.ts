import type { FastifyReply, FastifyRequest } from "fastify";
import type { Database } from "../db/client.js";
import { resolvePrincipal } from "./principal.js";
import type { AuthenticatedPrincipal, AuthenticationAdapter } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    principal: AuthenticatedPrincipal | null;
  }
}

function bearerCredential(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() || null;
}

export async function authenticateRequest(
  request: FastifyRequest,
  reply: FastifyReply,
  dependencies: { db: Database; adapter: AuthenticationAdapter }
): Promise<void> {
  request.principal = null;
  const credential = bearerCredential(request);

  if (!credential) {
    reply.code(401).send({
      error: "UNAUTHORIZED",
      message: "المصادقة مطلوبة"
    });
    return;
  }

  try {
    const identity = await dependencies.adapter.verifyCredential(credential);
    request.principal = await resolvePrincipal(dependencies.db, identity);

    if (!request.principal) {
      reply.code(401).send({
        error: "UNAUTHORIZED",
        message: "هوية المستخدم غير صالحة"
      });
    }
  } catch {
    reply.code(401).send({
      error: "UNAUTHORIZED",
      message: "بيانات المصادقة غير صالحة"
    });
  }
}
