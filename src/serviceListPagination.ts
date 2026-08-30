import { createHmac, timingSafeEqual } from "node:crypto";

export const DEFAULT_SERVICE_PAGE_SIZE = 100;
export const MAX_SERVICE_PAGE_SIZE = 100;
const CURSOR_VERSION = 1;
const DEFAULT_CURSOR_TTL_MS = 24 * 60 * 60 * 1000;

export type ServiceListScope = {
  tenantId: string;
  prefix: string;
  q: string;
  disabled: boolean | undefined;
  minPrice: number | undefined;
  maxPrice: number | undefined;
};

type ServiceCursorPayload = {
  v: number;
  tenantId: string;
  serviceId: string;
  scope: ServiceListScope;
  issuedAt: number;
};

export class ServiceCursorError extends Error {
  readonly code = "invalid_cursor";

  constructor(message: string) {
    super(message);
    this.name = "ServiceCursorError";
  }
}

/** Converts a query value into a bounded page size at the service boundary. */
export function normalizeServicePageSize(value: unknown): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null || raw === "") return DEFAULT_SERVICE_PAGE_SIZE;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_SERVICE_PAGE_SIZE;
  return Math.min(MAX_SERVICE_PAGE_SIZE, Math.max(1, Math.trunc(parsed)));
}

/** Creates the canonical scope embedded in every service-list cursor. */
export function serviceListScope(
  tenantId: string,
  options: Omit<ServiceListScope, "tenantId"> = {
    prefix: "",
    q: "",
    disabled: undefined,
    minPrice: undefined,
    maxPrice: undefined,
  }
): ServiceListScope {
  return {
    tenantId,
    prefix: options.prefix,
    q: options.q,
    disabled: options.disabled,
    minPrice: options.minPrice,
    maxPrice: options.maxPrice,
  };
}

function cursorSecret(): string {
  return (
    process.env.SERVICE_CURSOR_SECRET ??
    process.env.CURSOR_SECRET ??
    "agentpay-service-cursor-development-secret"
  );
}

function cursorTtlMs(): number {
  const configured = Number(process.env.SERVICE_CURSOR_TTL_MS);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_CURSOR_TTL_MS;
}

function sign(payload: string): string {
  return createHmac("sha256", cursorSecret()).update(payload).digest("hex");
}

function encodePayload(payload: ServiceCursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(raw: string): ServiceCursorPayload {
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) {
    throw new ServiceCursorError("cursor is malformed");
  }
  let parsed: unknown;
  try {
    const decoded = Buffer.from(raw, "base64url");
    if (decoded.toString("base64url") !== raw) throw new Error("non-canonical payload");
    parsed = JSON.parse(decoded.toString("utf8"));
  } catch {
    throw new ServiceCursorError("cursor is malformed");
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new ServiceCursorError("cursor is malformed");
  }
  const payload = parsed as Partial<ServiceCursorPayload>;
  if (
    payload.v !== CURSOR_VERSION ||
    typeof payload.tenantId !== "string" ||
    payload.tenantId.length === 0 ||
    typeof payload.serviceId !== "string" ||
    payload.serviceId.length === 0 ||
    typeof payload.issuedAt !== "number" ||
    !Number.isFinite(payload.issuedAt) ||
    payload.scope === undefined
  ) {
    throw new ServiceCursorError("cursor is malformed");
  }
  return payload as ServiceCursorPayload;
}

function scopesEqual(left: ServiceListScope, right: ServiceListScope): boolean {
  return (
    left.tenantId === right.tenantId &&
    left.prefix === right.prefix &&
    left.q === right.q &&
    left.disabled === right.disabled &&
    left.minPrice === right.minPrice &&
    left.maxPrice === right.maxPrice
  );
}

/** Encodes an opaque, signed service-list position. */
export function encodeServiceCursor(
  serviceId: string,
  scope: ServiceListScope,
  now = Date.now()
): string {
  if (serviceId.length === 0 || scope.tenantId.length === 0) {
    throw new TypeError("service cursor requires a service id and tenant");
  }
  const payload = encodePayload({
    v: CURSOR_VERSION,
    tenantId: scope.tenantId,
    serviceId,
    scope,
    issuedAt: now,
  });
  return `${payload}.${sign(payload)}`;
}

/** Decodes, verifies, expires, and binds a cursor to the current list scope. */
export function decodeServiceCursor(
  cursor: unknown,
  expectedScope: ServiceListScope,
  now = Date.now()
): string {
  if (typeof cursor !== "string") throw new ServiceCursorError("cursor is malformed");
  const pieces = cursor.split(".");
  if (
    pieces.length !== 2 ||
    pieces[0].length === 0 ||
    !/^[a-f0-9]{64}$/.test(pieces[1])
  ) {
    throw new ServiceCursorError("cursor is malformed");
  }
  const payload = pieces[0];
  const suppliedSignature = Buffer.from(pieces[1], "hex");
  const expectedSignature = Buffer.from(sign(payload), "hex");
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    throw new ServiceCursorError("cursor is invalid");
  }

  const decoded = decodePayload(payload);
  if (
    !scopesEqual(decoded.scope, expectedScope) ||
    decoded.tenantId !== expectedScope.tenantId
  ) {
    throw new ServiceCursorError("cursor does not match this service query");
  }
  if (decoded.issuedAt > now || now - decoded.issuedAt > cursorTtlMs()) {
    throw new ServiceCursorError("cursor is expired");
  }
  return decoded.serviceId;
}

/**
 * Returns the stable order used by the list route. Service ids are unique per
 * tenant, so the lexical id is both the primary key and deterministic cursor.
 */
export function compareServiceIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
