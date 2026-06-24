export type ParseIntParamOptions = {
  default: number;
  min: number;
  max: number;
};

/**
 * Parses an integer query parameter with a safe fallback and bounded range.
 * Non-finite or NaN values use the default, while valid numbers are truncated
 * and clamped to the inclusive min/max range.
 */
export function parseIntParam(
  value: unknown,
  options: ParseIntParamOptions
): number {
  const candidate =
    typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  const parsed = Number.isFinite(candidate) ? Math.trunc(candidate) : options.default;

  return Math.min(options.max, Math.max(options.min, parsed));
}
