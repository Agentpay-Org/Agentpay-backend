import { createStoreMap, createStoreSet, flushStores } from "./index.js";

export { flushStores };

/**
 * Mutable stores used by the AgentPay API.
 *
 * The default storage driver is in-memory. Set STORAGE_DRIVER=file to back
 * service, usage, API-key, metadata, disabled-service, and webhook stores with
 * JSON files that survive process restarts.
 */

export type ApiKeyRecord = { label: string; createdAt: number };
export type ServiceMetadataDto = { description: string; owner: string };
export type WebhookRecord = { url: string; events: string[]; createdAt: number };

/** Mirrors the on-chain pause flag for write-gated endpoints. */
export const pauseState = { paused: false };

/** Runtime-tunable in-memory configuration returned by /api/v1/config. */
export const config: Record<string, number> = {
  rateLimitPerWindow: 60,
  rateLimitWindowMs: 60_000,
  bulkMaxItems: 100,
  eventLogCap: 10_000,
};

/** Opaque API keys keyed by full secret token. */
export const apiKeyStore = createStoreMap<ApiKeyRecord>("api-keys");

/** Outstanding usage counters keyed by `${agent}::${serviceId}`. */
export const usageStore = createStoreMap<number>("usage");

/** Builds the shared in-memory usage key for an agent/service pair. */
export const usageKey = (agent: string, serviceId: string) => `${agent}::${serviceId}`;

/** Registered services and their per-request prices. */
export const servicesStore = createStoreMap<{ priceStroops: number }>("services");

/** Services currently disabled for write traffic. */
export const servicesDisabled = createStoreSet("services-disabled");

/** Optional service description/owner metadata. */
export const servicesMetadata = createStoreMap<ServiceMetadataDto>("services-metadata");

/** Registered webhooks and their event subscriptions. */
export const webhookStore = createStoreMap<WebhookRecord>("webhooks");

/** Rate-limiter windows keyed by source IP. */
export const rateBuckets = new Map<string, number[]>();

export const RATE_LIMIT_PER_WINDOW = 60;
export const RATE_LIMIT_WINDOW_MS = 60_000;
