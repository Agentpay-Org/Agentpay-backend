import { usageStore } from "./store/state.js";

export type UsageScanEntry = {
  agent: string;
  serviceId: string;
  total: number;
};

export type UsageKeyParts = Pick<UsageScanEntry, "agent" | "serviceId">;

/**
 * Parses the shared `${agent}::${serviceId}` usage-store key format.
 */
export function parseUsageKey(key: string): UsageKeyParts {
  const separator = key.indexOf("::");
  if (separator === -1) {
    return { agent: key, serviceId: "" };
  }

  return {
    agent: key.slice(0, separator),
    serviceId: key.slice(separator + 2),
  };
}

/**
 * Scans every usage-store entry with a single key parser.
 */
export function scanUsageStore(): UsageScanEntry[] {
  const entries: UsageScanEntry[] = [];
  for (const [key, total] of usageStore.entries()) {
    entries.push({ ...parseUsageKey(key), total });
  }
  return entries;
}

/**
 * Returns all usage entries belonging to one agent.
 */
export function scanByAgent(agent: string): UsageScanEntry[] {
  return scanUsageStore().filter((entry) => entry.agent === agent);
}

/**
 * Returns all usage entries belonging to one service.
 */
export function scanByService(serviceId: string): UsageScanEntry[] {
  return scanUsageStore().filter((entry) => entry.serviceId === serviceId);
}
