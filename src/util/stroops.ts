function assertSafeNonNegativeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

/**
 * Multiplies usage counts by per-request stroop prices without converting the
 * billed amount back to Number, so JSON responses can preserve exact ledger
 * units above 2^53.
 */
export function multiplyStroops(requests: number, priceStroops: number): string {
  assertSafeNonNegativeInteger(requests, "requests");
  assertSafeNonNegativeInteger(priceStroops, "priceStroops");
  return (BigInt(requests) * BigInt(priceStroops)).toString();
}

/** Adds decimal-string stroop totals while preserving exact integer precision. */
export function addStroops(left: string, right: string): string {
  return (BigInt(left) + BigInt(right)).toString();
}
