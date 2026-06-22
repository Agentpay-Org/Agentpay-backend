import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Hash an API key before storage so in-memory dumps do not expose live tokens.
 */
function hashApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function safeEqualHex(left: string, right: string) {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return (
    leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes)
  );
}

/**
 * Constant-time comparison of a presented API key against a stored SHA-256 hash.
 */
function apiKeyMatchesHash(candidate: string, storedHash: string) {
  return safeEqualHex(hashApiKey(candidate), storedHash);
}

/**
 * Constant-time comparison for an env-provided admin key.
 */
function secureStringEqual(candidate: string, expected: string) {
  const candidateHash = hashApiKey(candidate);
  const expectedHash = hashApiKey(expected);
  return safeEqualHex(candidateHash, expectedHash);
}

export { apiKeyMatchesHash, hashApiKey, secureStringEqual };
