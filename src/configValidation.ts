import { BULK_MAX_ITEMS_LIMIT } from "./store/state.js";

export const allowedConfigKeys = [
  "rateLimitPerWindow",
  "rateLimitWindowMs",
  "bulkMaxItems",
  "eventLogCap",
  "usageStoreMaxKeys",
  "servicesStoreMaxKeys",
  "webhookStoreMaxKeys",
  "apiKeyStoreMaxKeys",
] as const;

const configCeilings: Record<string, number> = {
  bulkMaxItems: BULK_MAX_ITEMS_LIMIT,
  eventLogCap: 100_000,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Validates one config value, returning an error message when invalid. */
function validateConfigValue(key: string, value: unknown): string | undefined {
  const isInteger = typeof value === "number" && Number.isInteger(value);
  if (key === "bulkMaxItems") {
    if (!isInteger || value < 1 || value > BULK_MAX_ITEMS_LIMIT) {
      return `bulkMaxItems must be an integer between 1 and ${BULK_MAX_ITEMS_LIMIT}`;
    }
    return undefined;
  }
  if (!isInteger || value < 1) {
    return `${key} must be a positive integer`;
  }
  const ceiling = configCeilings[key];
  if (ceiling !== undefined && value > ceiling) {
    return `${key} must be less than or equal to ${ceiling}`;
  }
  return undefined;
}

export type ConfigPatchValidationResult =
  | { ok: true; updates: Record<string, number> }
  | { ok: false; message: string; unknownKeys?: string[] };

export function validateConfigPatchBody(body: unknown): ConfigPatchValidationResult {
  const updates = body ?? {};
  if (!isPlainObject(updates)) {
    return {
      ok: false,
      message: "body must be a JSON object",
    };
  }

  const unknownKeys = Object.keys(updates).filter(
    (key) => !(allowedConfigKeys as readonly string[]).includes(key)
  );
  if (unknownKeys.length > 0) {
    return {
      ok: false,
      message: `unknown config keys: ${unknownKeys.join(", ")}`,
      unknownKeys,
    };
  }

  for (const key of allowedConfigKeys) {
    if (!(key in updates)) continue;
    const message = validateConfigValue(key, updates[key]);
    if (message) {
      return { ok: false, message };
    }
  }

  return { ok: true, updates: updates as Record<string, number> };
}
