import { config } from "./state.js";

export type StoreCapKey =
  | "usageStoreMaxKeys"
  | "servicesStoreMaxKeys"
  | "webhookStoreMaxKeys"
  | "apiKeyStoreMaxKeys";

export type StoreCapacityError = {
  error: "store_capacity_exceeded";
  message: string;
  requestId: string | undefined;
  store: string;
  limit: number;
};

export function getStoreCap(capKey: StoreCapKey): number {
  return config[capKey];
}

/**
 * Checks whether adding a map entry would stay within the configured cap.
 */
export function hasCapacityForNewKey<K, V>(
  store: Map<K, V>,
  key: K,
  capKey: StoreCapKey
): boolean {
  return store.has(key) || store.size < getStoreCap(capKey);
}

export function storeCapacityError(
  storeName: string,
  capKey: StoreCapKey,
  requestId: string | undefined
): StoreCapacityError {
  const limit = getStoreCap(capKey);
  return {
    error: "store_capacity_exceeded",
    message: `${storeName} has reached its configured capacity of ${limit} keys`,
    requestId,
    store: storeName,
    limit,
  };
}
