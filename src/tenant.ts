import type { Request } from "express";
import type { AgentPayRequest } from "./types.js";

export const IMPLICIT_TENANT_ID = "implicit";

const TENANT_KEY_PREFIX = "tenant:";
const KEY_SEPARATOR = "::";

/**
 * Resolves the tenant for service and usage state.
 *
 * Recognized API keys become their own tenants. Requests without a validated
 * API key share the implicit development tenant so auth-disabled local flows
 * keep the historical single-tenant behavior.
 */
export function resolveTenantId(req: Request): string {
  return (req as AgentPayRequest).apiKey ?? IMPLICIT_TENANT_ID;
}

export function tenantServiceKey(tenantId: string, serviceId: string): string {
  if (tenantId === IMPLICIT_TENANT_ID) return serviceId;
  return `${TENANT_KEY_PREFIX}${tenantId}${KEY_SEPARATOR}${serviceId}`;
}

export function tenantUsageKey(
  tenantId: string,
  agent: string,
  serviceId: string
): string {
  const usageKey = `${agent}${KEY_SEPARATOR}${serviceId}`;
  if (tenantId === IMPLICIT_TENANT_ID) return usageKey;
  return `${TENANT_KEY_PREFIX}${tenantId}${KEY_SEPARATOR}${usageKey}`;
}

export function serviceIdFromStoreKey(
  tenantId: string,
  storeKey: string
): string | undefined {
  if (tenantId === IMPLICIT_TENANT_ID) {
    return storeKey.startsWith(TENANT_KEY_PREFIX) ? undefined : storeKey;
  }

  const prefix = `${TENANT_KEY_PREFIX}${tenantId}${KEY_SEPARATOR}`;
  if (!storeKey.startsWith(prefix)) return undefined;
  return storeKey.slice(prefix.length);
}

export type UsageStoreParts = {
  agent: string;
  serviceId: string;
};

export function usagePartsFromStoreKey(
  tenantId: string,
  storeKey: string
): UsageStoreParts | undefined {
  if (tenantId === IMPLICIT_TENANT_ID && storeKey.startsWith(TENANT_KEY_PREFIX)) {
    return undefined;
  }

  const scopedKey =
    tenantId === IMPLICIT_TENANT_ID ? storeKey : stripTenantPrefix(tenantId, storeKey);
  if (!scopedKey) return undefined;

  return splitUsageKey(scopedKey);
}

export function usagePartsFromAnyStoreKey(
  storeKey: string
): UsageStoreParts | undefined {
  if (!storeKey.startsWith(TENANT_KEY_PREFIX)) return splitUsageKey(storeKey);

  const withoutPrefix = storeKey.slice(TENANT_KEY_PREFIX.length);
  const separatorIndex = withoutPrefix.indexOf(KEY_SEPARATOR);
  if (separatorIndex === -1) return undefined;
  return splitUsageKey(withoutPrefix.slice(separatorIndex + KEY_SEPARATOR.length));
}

function stripTenantPrefix(tenantId: string, storeKey: string): string | undefined {
  const prefix = `${TENANT_KEY_PREFIX}${tenantId}${KEY_SEPARATOR}`;
  if (!storeKey.startsWith(prefix)) return undefined;
  return storeKey.slice(prefix.length);
}

function splitUsageKey(scopedKey: string): UsageStoreParts | undefined {
  const separatorIndex = scopedKey.indexOf(KEY_SEPARATOR);
  if (separatorIndex === -1) return undefined;
  return {
    agent: scopedKey.slice(0, separatorIndex),
    serviceId: scopedKey.slice(separatorIndex + KEY_SEPARATOR.length),
  };
}
