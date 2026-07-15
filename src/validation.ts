export const MAX_REQUESTS_PER_CALL = 1_000_000;
export const MAX_PRICE_STROOPS = Math.floor(
  Number.MAX_SAFE_INTEGER / MAX_REQUESTS_PER_CALL
);

/**
 * Accepts one positive per-call usage count that cannot by itself push billing
 * multiplication outside JavaScript's safe-integer range.
 */
export function isSafeCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_REQUESTS_PER_CALL
  );
}

/**
 * Accepts one non-negative service price that remains safe when multiplied by
 * the maximum accepted per-call usage count.
 */
export function isSafePrice(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_PRICE_STROOPS
  );
}
