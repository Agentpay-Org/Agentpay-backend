/**
 * Service-level optimistic concurrency primitives.
 *
 * AgentPay currently uses process-local maps, but the update contract is
 * deliberately storage-shaped: a future SQL/Redis store can implement the
 * same compare-and-set predicate without changing clients.
 */

export const INITIAL_SERVICE_VERSION = 1;

export type VersionedServiceState = {
  version: number;
};

export type VersionConflictPayload = {
  error: 'version_conflict';
  expectedVersion: number;
  currentVersion: number;
  retryable: true;
};

export class InvalidServiceVersionError extends Error {
  readonly code = 'invalid_request';
  readonly statusCode = 400;

  constructor() {
    super('expectedVersion must be a positive integer');
    this.name = 'InvalidServiceVersionError';
  }
}

export class ServiceVersionConflictError extends Error {
  readonly code = 'version_conflict';
  readonly statusCode = 409;
  readonly retryable = true;

  constructor(
    readonly expectedVersion: number,
    readonly currentVersion: number,
  ) {
    super('service was modified; re-read and retry with the current version');
    this.name = 'ServiceVersionConflictError';
  }

  toJSON(): VersionConflictPayload {
    return {
      error: 'version_conflict',
      expectedVersion: this.expectedVersion,
      currentVersion: this.currentVersion,
      retryable: true,
    };
  }
}

/** Normalize only JSON integer values; do not coerce floats or numeric strings. */
export function parseServiceVersion(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isSafeInteger(value) || value < INITIAL_SERVICE_VERSION) return undefined;
  return value;
}

/** Parse a required request version and use one error for every endpoint. */
export function requireServiceVersion(value: unknown): number {
  const parsed = parseServiceVersion(value);
  if (parsed === undefined) throw new InvalidServiceVersionError();
  return parsed;
}

/** Return a version for a row, healing legacy rows that predate OCC. */
export function versionForService(
  serviceExists: boolean,
  versions: Map<string, number>,
  key: string,
): number {
  if (!serviceExists) return INITIAL_SERVICE_VERSION;
  const existing = versions.get(key);
  if (existing === undefined) {
    versions.set(key, INITIAL_SERVICE_VERSION);
    return INITIAL_SERVICE_VERSION;
  }
  return existing;
}

/** Advance exactly once after a successful state mutation. */
export function nextServiceVersion(
  versions: Map<string, number>,
  key: string,
  currentVersion: number,
): number {
  const next = currentVersion + 1;
  if (!Number.isSafeInteger(next)) {
    throw new RangeError('service version exhausted safe integer range');
  }
  versions.set(key, next);
  return next;
}

/** Pure compare-and-set decision; callers apply the mutation only on success. */
export function canUpdateService(
  currentVersion: number,
  expectedVersion: unknown,
): { ok: true; version: number } | { ok: false; error: ServiceVersionConflictError } {
  const expected = requireServiceVersion(expectedVersion);
  if (expected !== currentVersion) {
    return { ok: false, error: new ServiceVersionConflictError(expected, currentVersion) };
  }
  return { ok: true, version: expected };
}

/** Safe response data for handlers that want to serialize a conflict. */
export function conflictResponse(
  error: ServiceVersionConflictError,
  requestId?: string,
): VersionConflictPayload & { message: string; requestId?: string } {
  return {
    ...error.toJSON(),
    message: error.message,
    ...(requestId === undefined ? {} : { requestId }),
  };
}

export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const DEFAULT_SERVICE_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 25,
  maxDelayMs: 1_000,
};

/**
 * Calculate a bounded delay for clients or workers. This helper never retries
 * by itself and therefore cannot replay a stale business decision.
 */
export function serviceRetryDelay(
  attempt: number,
  policy: Partial<RetryPolicy> = {},
): number {
  const selected = { ...DEFAULT_SERVICE_RETRY_POLICY, ...policy };
  if (!Number.isSafeInteger(attempt) || attempt < 1) {
    throw new RangeError('attempt must be a positive integer');
  }
  if (attempt >= selected.maxAttempts) return 0;
  return Math.min(
    selected.maxDelayMs,
    selected.baseDelayMs * 2 ** (attempt - 1),
  );
}

/** Human guidance for SDKs that do not want to parse the response body. */
export function serviceRetryInstruction(currentVersion: number): string {
  const version = requireServiceVersion(currentVersion);
  return `Re-read the service and retry with expectedVersion ${version}.`;
}
