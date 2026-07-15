type IntParamOptions = {
  defaultValue: number;
  min: number;
  max: number;
};

/**
 * Parses integer query params with fallback and bounded output.
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
