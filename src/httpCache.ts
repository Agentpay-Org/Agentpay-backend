import { createHash } from "node:crypto";

/**
 * Builds the weak ETag used for pollable JSON read responses.
 *
 * Pass the response body for body-only validators, or a small cache identity
 * object when the route must distinguish identical bodies from different
 * query scopes.
 */
export function etagFor(body: unknown): string {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return `W/"${createHash("sha1")
    .update(payload ?? "null")
    .digest("base64")
    .slice(0, 16)}"`;
}
