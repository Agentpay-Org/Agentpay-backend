export function isSafePositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function assertSafeNonNegativeInteger(name: string, value: number): void {
  if (!isSafeNonNegativeInteger(value)) {
    throw new RangeError(`${name} must be a safe non-negative integer`);
  }
}

/**
 * Multiplies request counts by stroop prices with BigInt so JSON responses
 * never lose precision above Number.MAX_SAFE_INTEGER.
 */
export function multiplyStroops(requests: number, priceStroops: number): string {
  assertSafeNonNegativeInteger("requests", requests);
  assertSafeNonNegativeInteger("priceStroops", priceStroops);

  return (BigInt(requests) * BigInt(priceStroops)).toString();
}

export function sumStroops(values: Iterable<string>): string {
  let total = 0n;
  for (const value of values) {
    total += BigInt(value);
  }
  return total.toString();
}
