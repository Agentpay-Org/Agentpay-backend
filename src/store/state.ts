/**
 * Mutable process-local stores used by the in-memory AgentPay API.
 *
 * These exports preserve the existing development behavior: state lives only
 * for the lifetime of the Node process and resets on restart.
 */

import { IMPLICIT_TENANT_ID, tenantUsageKey } from "../tenant.js";

export type ApiKeyRecord = { label: string; createdAt: number };
export type ServiceMetadataDto = { description: string; owner: string };
export type WebhookRecord = { url: string; events: string[]; createdAt: number };

/** Mirrors the on-chain pause flag for write-gated endpoints. */
export const pauseState = { paused: false };

/** Default process-local runtime config values. */
export const DEFAULT_CONFIG: Record<string, number> = {
  rateLimitPerWindow: 60,
  rateLimitWindowMs: 60_000,
  bulkMaxItems: 100,
  eventLogCap: 10_000,
  usageStoreMaxKeys: 100_000,
  servicesStoreMaxKeys: 10_000,
  webhookStoreMaxKeys: 10_000,
  apiKeyStoreMaxKeys: 10_000,
};

/** Runtime-tunable in-memory configuration returned by /api/v1/config. */
export const config: Record<string, number> = { ...DEFAULT_CONFIG };

/** Opaque API keys keyed by full secret token. */
export const apiKeyStore = new Map<string, ApiKeyRecord>();

/** Outstanding usage counters keyed by tenant-aware usage keys. */
export const usageStore = new Map<string, number>();

/**
 * Cumulative process-local settlement counters.
 * Stroops are stored as bigint and serialized as decimal strings for JSON.
 */
export const settlementCounters = {
  settledStroopsTotal: 0n,
  settlementsTotal: 0,
};

/** Builds the shared in-memory usage key for an agent/service pair. */
export const usageKey = (
  agent: string,
  serviceId: string,
  tenantId = IMPLICIT_TENANT_ID
) => tenantUsageKey(tenantId, agent, serviceId);

/** Registered services and their per-request prices, keyed by tenant-aware id. */
export const servicesStore = new Map<string, { priceStroops: number }>();

/** Services currently disabled for write traffic, keyed by tenant-aware id. */
export const servicesDisabled = new Set<string>();

/** Optional service description/owner metadata, keyed by tenant-aware id. */
export const servicesMetadata = new Map<string, ServiceMetadataDto>();

/** Registered webhooks and their event subscriptions. */
export const webhookStore = new Map<string, WebhookRecord>();

/** Rate-limiter windows keyed by source IP. */
export const rateBuckets = new Map<string, number[]>();

export const RATE_LIMIT_PER_WINDOW = 60;
export const RATE_LIMIT_WINDOW_MS = 60_000;
