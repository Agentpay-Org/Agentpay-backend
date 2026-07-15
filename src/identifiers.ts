export const AGENT_ID_MAX_LENGTH = 256;
export const SERVICE_ID_MAX_LENGTH = 128;

const SAFE_IDENTIFIER_RE = /^[A-Za-z0-9._-]+$/;

function isValidIdentifier(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !value.includes("::") &&
    SAFE_IDENTIFIER_RE.test(value)
  );
}

export function isValidAgentId(value: unknown): value is string {
  return isValidIdentifier(value, AGENT_ID_MAX_LENGTH);
}

export function isValidServiceId(value: unknown): value is string {
  return isValidIdentifier(value, SERVICE_ID_MAX_LENGTH);
}
