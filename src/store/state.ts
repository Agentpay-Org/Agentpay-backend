/**
 * Mutable process-local stores used by the in-memory AgentPay API.
 *
 * These exports preserve the existing development behavior: state lives only
 * for the lifetime of the Node process and resets on restart.
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
export const apiKeyStore = new Map<string, ApiKeyRecord>();

/** Outstanding usage counters keyed by `${agent}::${serviceId}`. */
export const usageStore = new Map<string, number>();

/** Builds the shared in-memory usage key for an agent/service pair. */
export const usageKey = (agent: string, serviceId: string) => `${agent}::${serviceId}`;

/** Registered services and their per-request prices. */
export const servicesStore = new Map<string, { priceStroops: number }>();

/** Services currently disabled for write traffic. */
export const servicesDisabled = new Set<string>();

/** Optional service description/owner metadata. */
export const servicesMetadata = new Map<string, ServiceMetadataDto>();

/** Registered webhooks and their event subscriptions. */
export const webhookStore = new Map<string, WebhookRecord>();

/** Rate-limiter windows keyed by authenticated API key digest or trusted IP. */
export const rateBuckets = new Map<string, number[]>();

export const RATE_LIMIT_PER_WINDOW = 60;
export const RATE_LIMIT_WINDOW_MS = 60_000;
