export const MAX_REQUESTS_PER_CALL = 1_000_000;
export const MAX_PRICE_STROOPS = Math.floor(
  Number.MAX_SAFE_INTEGER / MAX_REQUESTS_PER_CALL
);

/**
 * Checks a per-call usage count before it can enter counters or billing math.
 */
export function isSafeCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= MAX_REQUESTS_PER_CALL
  );
}

/**
 * Checks a per-request price so max count * max price stays a safe integer.
 */
export function isSafePrice(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_PRICE_STROOPS
  );
}
