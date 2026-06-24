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

/** Builds the shared in-memory usage key for an agent/service pair. */
export const usageKey = (agent: string, serviceId: string) => `${agent}::${serviceId}`;

type UsageKeyParts = { agent: string; serviceId: string };

const parseUsageKey = (key: string): UsageKeyParts | undefined => {
  const [agent, serviceId] = key.split("::");
  if (!agent || serviceId === undefined) return undefined;
  return { agent, serviceId };
};

const addKey = (index: Map<string, Set<string>>, bucket: string, key: string) => {
  const keys = index.get(bucket);
  if (keys) {
    keys.add(key);
    return;
  }
  index.set(bucket, new Set([key]));
};

const removeKey = (index: Map<string, Set<string>>, bucket: string, key: string) => {
  const keys = index.get(bucket);
  if (!keys) return;
  keys.delete(key);
  if (keys.size === 0) index.delete(bucket);
};

const addTotal = (totals: Map<string, number>, bucket: string, delta: number) => {
  totals.set(bucket, (totals.get(bucket) ?? 0) + delta);
};

/**
 * Usage keys grouped by agent so agent rollups avoid scanning the full store.
 */
export const usageByAgent = new Map<string, Set<string>>();

/**
 * Usage keys grouped by service so service rollups avoid scanning the full store.
 */
export const usageByService = new Map<string, Set<string>>();

/** Outstanding request totals grouped by agent. */
export const usageTotalsByAgent = new Map<string, number>();

/** Outstanding request totals grouped by service. */
export const usageTotalsByService = new Map<string, number>();

let usageTotalRequests = 0;

/**
 * Returns the protocol-wide outstanding request total maintained on writes.
 */
export const getUsageTotalRequests = () => usageTotalRequests;

/**
 * Verifies the maintained usage indexes against a brute-force store scan.
 * This is intended for regression tests and health checks, not request paths.
 */
export const assertUsageIndexesConsistent = () => {
  const expectedByAgent = new Map<string, Set<string>>();
  const expectedByService = new Map<string, Set<string>>();
  const expectedAgentTotals = new Map<string, number>();
  const expectedServiceTotals = new Map<string, number>();
  let expectedTotal = 0;

  for (const [key, total] of usageStore.entries()) {
    expectedTotal += total;
    const parts = parseUsageKey(key);
    if (!parts) continue;
    addKey(expectedByAgent, parts.agent, key);
    addKey(expectedByService, parts.serviceId, key);
    addTotal(expectedAgentTotals, parts.agent, total);
    addTotal(expectedServiceTotals, parts.serviceId, total);
  }

  const serializeSets = (index: Map<string, Set<string>>) =>
    JSON.stringify(
      Array.from(index.entries()).map(([bucket, keys]) => [
        bucket,
        Array.from(keys).sort(),
      ])
    );
  const serializeTotals = (totals: Map<string, number>) =>
    JSON.stringify(Array.from(totals.entries()));

  if (
    usageTotalRequests !== expectedTotal ||
    serializeSets(usageByAgent) !== serializeSets(expectedByAgent) ||
    serializeSets(usageByService) !== serializeSets(expectedByService) ||
    serializeTotals(usageTotalsByAgent) !== serializeTotals(expectedAgentTotals) ||
    serializeTotals(usageTotalsByService) !== serializeTotals(expectedServiceTotals)
  ) {
    throw new Error("usage indexes are inconsistent with usageStore");
  }
};

class IndexedUsageStore extends Map<string, number> {
  set(key: string, value: number): this {
    const previous = super.get(key) ?? 0;
    const existed = super.has(key);
    super.set(key, value);

    const delta = value - previous;
    usageTotalRequests += delta;
    const parts = parseUsageKey(key);
    if (!parts) return this;

    if (!existed) {
      addKey(usageByAgent, parts.agent, key);
      addKey(usageByService, parts.serviceId, key);
    }
    addTotal(usageTotalsByAgent, parts.agent, delta);
    addTotal(usageTotalsByService, parts.serviceId, delta);

    return this;
  }

  delete(key: string): boolean {
    const previous = super.get(key);
    const deleted = super.delete(key);
    if (!deleted) return false;

    usageTotalRequests -= previous ?? 0;
    const parts = parseUsageKey(key);
    if (!parts) return true;

    removeKey(usageByAgent, parts.agent, key);
    removeKey(usageByService, parts.serviceId, key);
    addTotal(usageTotalsByAgent, parts.agent, -(previous ?? 0));
    addTotal(usageTotalsByService, parts.serviceId, -(previous ?? 0));
    if (!usageByAgent.has(parts.agent)) usageTotalsByAgent.delete(parts.agent);
    if (!usageByService.has(parts.serviceId))
      usageTotalsByService.delete(parts.serviceId);

    return true;
  }

  clear(): void {
    super.clear();
    usageByAgent.clear();
    usageByService.clear();
    usageTotalsByAgent.clear();
    usageTotalsByService.clear();
    usageTotalRequests = 0;
  }
}

/** Outstanding usage counters keyed by `${agent}::${serviceId}`. */
export const usageStore = new IndexedUsageStore();

/** Registered services and their per-request prices. */
export const servicesStore = new Map<string, { priceStroops: number }>();

/** Services currently disabled for write traffic. */
export const servicesDisabled = new Set<string>();

/** Optional service description/owner metadata. */
export const servicesMetadata = new Map<string, ServiceMetadataDto>();

/** Registered webhooks and their event subscriptions. */
export const webhookStore = new Map<string, WebhookRecord>();

/** Rate-limiter windows keyed by source IP. */
export const rateBuckets = new Map<string, number[]>();

export const RATE_LIMIT_PER_WINDOW = 60;
export const RATE_LIMIT_WINDOW_MS = 60_000;
