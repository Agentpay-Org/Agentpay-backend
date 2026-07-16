import { DEFAULT_TENANT_ID } from "../tenant.js";

/**
 * Mutable process-local stores used by the in-memory AgentPay API.
 *
 * These exports preserve the existing development behavior: state lives only
 * for the lifetime of the Node process and resets on restart.
 */

export type ApiKeyRecord = { label: string; createdAt: number; prefix: string };
export type ServiceMetadataDto = { description: string; owner: string };
export type WebhookRecord = { url: string; events: string[]; createdAt: number };

/** Mirrors the on-chain pause flag for write-gated endpoints. */
export const pauseState = { paused: false };

const DEFAULT_RATE_LIMIT_PER_WINDOW = 60;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

/** Runtime-tunable in-memory configuration returned by /api/v1/config. */
export const config: Record<string, number> = {
  rateLimitPerWindow: DEFAULT_RATE_LIMIT_PER_WINDOW,
  rateLimitWindowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
  bulkMaxItems: 100,
  eventLogCap: 10_000,
  usageStoreMaxKeys: 100_000,
  servicesStoreMaxKeys: 10_000,
  webhookStoreMaxKeys: 10_000,
  apiKeyStoreMaxKeys: 10_000,
};

/** Opaque API keys keyed by SHA-256 hash, never by the live secret token. */
export const apiKeyStore = new Map<string, ApiKeyRecord>();

const TENANT_KEY_SEPARATOR = "\x1f";

/** Builds an internal key that keeps the historic public-tenant shape intact. */
export function serviceKey(tenantId: string, serviceId: string): string {
  return tenantId === DEFAULT_TENANT_ID
    ? serviceId
    : `${tenantId}${TENANT_KEY_SEPARATOR}${serviceId}`;
}

/**
 * Splits an internal service key into tenant and public service id pieces.
 */
export function parseServiceKey(key: string): {
  tenantId: string;
  serviceId: string;
} {
  const separatorIndex = key.indexOf(TENANT_KEY_SEPARATOR);
  if (separatorIndex === -1) {
    return { tenantId: DEFAULT_TENANT_ID, serviceId: key };
  }
  return {
    tenantId: key.slice(0, separatorIndex),
    serviceId: key.slice(separatorIndex + TENANT_KEY_SEPARATOR.length),
  };
}

/** Outstanding usage counters keyed by tenant/agent/service. */
export const usageStore = new Map<string, number>();

/** Builds the shared in-memory usage key for an agent/service pair. */
export function usageKey(a: string, b: string, c?: string): string {
  if (c === undefined) {
    return `${a}::${b}`;
  }
  return a === DEFAULT_TENANT_ID
    ? `${b}::${c}`
    : `${a}${TENANT_KEY_SEPARATOR}${b}::${c}`;
}

/**
 * Splits an internal usage key into tenant, agent, and public service id pieces.
 */
export function parseUsageKey(key: string): {
  tenantId: string;
  agent: string;
  serviceId: string;
} {
  let tenantId = DEFAULT_TENANT_ID;
  let remainder = key;
  const separatorIndex = key.indexOf(TENANT_KEY_SEPARATOR);
  if (separatorIndex !== -1) {
    tenantId = key.slice(0, separatorIndex);
    remainder = key.slice(separatorIndex + TENANT_KEY_SEPARATOR.length);
  }
  const [agent = "", serviceId = ""] = remainder.split("::");
  return { tenantId, agent, serviceId };
}

/** Registered services and their per-request prices, keyed by tenant-aware id. */
export const servicesStore = new Map<string, { priceStroops: number }>();

/** Services currently disabled for write traffic, keyed by tenant-aware id. */
export const servicesDisabled = new Set<string>();

/** Optional service description/owner metadata, keyed by tenant-aware id. */
export const servicesMetadata = new Map<string, ServiceMetadataDto>();

/** Registered webhooks and their event subscriptions. */
export const webhookStore = new Map<string, WebhookRecord>();

/** Rate-limiter windows keyed by authenticated API key digest or trusted IP. */
export const rateBuckets = new Map<string, number[]>();
