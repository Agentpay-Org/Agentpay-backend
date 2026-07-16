import type { Request } from "express";
import type { AgentPayRequest } from "./types.js";

export const DEFAULT_TENANT_ID = "public";

/**
 * Resolves the tenant that owns service and usage state for this request.
 *
 * When API-key recognition has validated a supplied key, the key is hashed into
 * a stable internal tenant id so the secret itself never becomes a store key or
 * response value. When auth enforcement is disabled or no known key is present,
 * all callers share the legacy public tenant.
 */
export function resolveTenantId(req: Request): string {
  const apiKeyHash = (req as AgentPayRequest).apiKeyHash;
  if (typeof apiKeyHash === "string" && apiKeyHash.length > 0) {
    return `api:${apiKeyHash}`;
  }
  return DEFAULT_TENANT_ID;
}
