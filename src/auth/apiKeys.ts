import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { ApiKeyRecord } from "../store/state.js";

export type VerifiedApiKey = {
  hash: string;
  prefix: string;
  record: ApiKeyRecord;
};

/** Hashes an API key before it is stored or compared. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Creates a tenant API key and the hashed in-memory record for it. */
export function createApiKeyRecord(
  label: string,
  now = Date.now()
): {
  key: string;
  hash: string;
  record: ApiKeyRecord;
} {
  const key = `apk_${randomUUID().replace(/-/g, "")}`;
  return {
    key,
    hash: hashApiKey(key),
    record: {
      label,
      createdAt: now,
      prefix: key.slice(0, 8),
    },
  };
}

/** Compares fixed-format SHA-256 hex digests without early-exit string checks. */
export function timingSafeEqualHex(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Compares two secrets by digest so length differences do not leak directly. */
export function timingSafeEqualSecret(supplied: string, expected: string): boolean {
  return timingSafeEqualHex(hashApiKey(supplied), hashApiKey(expected));
}

/**
 * Finds a supplied tenant key in the hashed store while comparing every stored
 * hash so the matching key does not determine the loop exit timing.
 */
export function verifyApiKey(
  supplied: string | undefined,
  store: Map<string, ApiKeyRecord>
): VerifiedApiKey | undefined {
  if (typeof supplied !== "string" || supplied.length === 0) {
    return undefined;
  }

  const suppliedHash = hashApiKey(supplied);
  let matched: VerifiedApiKey | undefined;
  for (const [storedHash, record] of store.entries()) {
    if (timingSafeEqualHex(suppliedHash, storedHash)) {
      matched = { hash: storedHash, prefix: record.prefix, record };
    }
  }
  return matched;
}
