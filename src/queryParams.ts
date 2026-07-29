type IntParamOptions = {
  defaultValue: number;
  min: number;
  max: number;
};

/**
 * Parses integer query params with fallback and bounded output.
 *
 * Safely handles malformed input (e.g. `?limit=abc`, `?limit=NaN`, `?limit=Infinity`)
 * by falling back to the default value. Clamps valid numeric inputs to the `[min, max]`
 * range. Truncates floats to integers before clamping.
 *
 * @param value - Raw query parameter value from `req.query` (may be string, number, array, or undefined)
 * @param options - Configuration object with `defaultValue`, `min`, and `max`
 * @returns The parsed integer, clamped to `[min, max]`, or `defaultValue` on invalid input
 *
 * @example
 * ```ts
 * // ?limit=abc → 10 (falls back to default)
 * parseIntParam(req.query.limit, { defaultValue: 10, min: 1, max: 100 });
 *
 * // ?limit=0 → 1 (clamps to min)
 * parseIntParam(req.query.limit, { defaultValue: 10, min: 1, max: 100 });
 *
 * // ?limit=250 → 100 (clamps to max)
 * parseIntParam(req.query.limit, { defaultValue: 10, min: 1, max: 100 });
 *
 * // ?limit=3.7 → 3 (truncates float)
 * parseIntParam(req.query.limit, { defaultValue: 10, min: 1, max: 100 });
 * ```
 */
export function parseIntParam(
  value: unknown,
  { defaultValue, min, max }: IntParamOptions
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" && typeof raw !== "number") return defaultValue;
  if (raw === "") return defaultValue;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return defaultValue;

  const integer = Math.trunc(parsed);
  return Math.min(max, Math.max(min, integer));
}
