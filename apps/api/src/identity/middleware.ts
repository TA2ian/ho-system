import type { FastifyReply, FastifyRequest } from "fastify";
import type { Database } from "../db/client.js";
import { resolvePrincipal } from "./principal.js";
import { InvalidAuthenticationError, type AuthenticatedPrincipal, type AuthenticationAdapter } from "./auth.js";

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
): Promise<boolean> {
  request.principal = null;
  const credential = bearerCredential(request);

  if (!credential) {
    reply.code(401).send({
      error: "UNAUTHORIZED",
      message: "المصادقة مطلوبة"
    });
    return false;
  }

  let identity: Awaited<ReturnType<AuthenticationAdapter["verifyCredential"]>>;
  try {
    identity = await dependencies.adapter.verifyCredential(credential);
  } catch (error) {
    if (!(error instanceof InvalidAuthenticationError)) {
      throw error;
    }

    reply.code(401).send({
      error: "UNAUTHORIZED",
      message: "بيانات المصادقة غير صالحة"
    });
    return false;
  }

  const principal = await resolvePrincipal(dependencies.db, identity);
  if (!principal) {
    reply.code(401).send({
      error: "UNAUTHORIZED",
      message: "هوية المستخدم غير صالحة"
    });
    return false;
  }

  request.principal = principal;
  return true;
}
