import type { Request } from "express";

/**
 * Request shape used by AgentPay middleware once request metadata has been
 * attached.
 */
export type AgentPayRequest = Request & {
  id?: string;
  apiKeyHash?: string;
  apiKeyPrefix?: string;
  adminApiKey?: true;
};

/**
 * Reads the middleware-populated request id without forcing every handler to
 * repeat the same type assertion.
 */
export function getRequestId(req: Request): string | undefined {
  return (req as AgentPayRequest).id;
}
