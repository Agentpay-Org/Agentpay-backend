import { chargeStore } from "../store/state.js";

export type ChargeStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "partially_refunded"
  | "refunded"
  | "failed";

/** The minimum ledger shape needed by reconciliation. */
export type ChargeRecord = {
  id: string;
  amount: number;
  capturedAmount: number;
  refundedAmount: number;
  status: ChargeStatus;
};

export type ChargeInvariantCode =
  | "INVALID_ID"
  | "INVALID_AMOUNT"
  | "CAPTURE_EXCEEDS_AMOUNT"
  | "REFUND_EXCEEDS_CAPTURE"
  | "PENDING_HAS_FUNDS"
  | "AUTHORIZED_HAS_FUNDS"
  | "CAPTURED_HAS_NO_CAPTURE"
  | "PARTIAL_REFUND_BALANCE"
  | "REFUNDED_BALANCE"
  | "FAILED_HAS_FUNDS"
  | "DUPLICATE_ID";

export type ChargeViolation = {
  chargeId: string;
  code: ChargeInvariantCode;
  reason: string;
};

export type ReconciliationOptions = {
  maxRecords?: number;
  chunkSize?: number;
};

export type ReconciliationReport = {
  scanned: number;
  maxRecords: number;
  chunkSize: number;
  truncated: boolean;
  violationCount: number;
  offendingIds: string[];
  violations: ChargeViolation[];
};

export type ChargeReconciliationErrorCode = "INVALID_RECORDS" | "INVALID_OPTIONS";

/** Stable error type for callers that provide an invalid reconciliation job. */
export class ChargeReconciliationError extends Error {
  readonly code: ChargeReconciliationErrorCode;

  constructor(code: ChargeReconciliationErrorCode, message: string) {
    super(message);
    this.name = "ChargeReconciliationError";
    this.code = code;
  }
}

export const DEFAULT_MAX_RECORDS = 10_000;
export const MAX_MAX_RECORDS = 100_000;
export const DEFAULT_CHUNK_SIZE = 500;
export const MAX_CHUNK_SIZE = 1_000;

function boundedInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new ChargeReconciliationError(
      "INVALID_OPTIONS",
      "reconciliation limits must be positive integers",
    );
  }
  return Math.min(value, maximum);
}

function violation(
  chargeId: string,
  code: ChargeInvariantCode,
  reason: string,
): ChargeViolation {
  return { chargeId, code, reason };
}

function validNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/** Checks one charge without consulting or mutating global state. */
export function checkChargeInvariants(charge: ChargeRecord): ChargeViolation[] {
  const violations: ChargeViolation[] = [];
  const id = typeof charge.id === "string" ? charge.id : "";
  if (id.length === 0) {
    violations.push(violation(id, "INVALID_ID", "charge id must be non-empty"));
  }

  if (!validNonNegativeInteger(charge.amount)) {
    violations.push(violation(id, "INVALID_AMOUNT", "amount must be a non-negative safe integer"));
  }
  if (!validNonNegativeInteger(charge.capturedAmount)) {
    violations.push(
      violation(id, "INVALID_AMOUNT", "capturedAmount must be a non-negative safe integer"),
    );
  }
  if (!validNonNegativeInteger(charge.refundedAmount)) {
    violations.push(
      violation(id, "INVALID_AMOUNT", "refundedAmount must be a non-negative safe integer"),
    );
  }

  if (validNonNegativeInteger(charge.amount) &&
      validNonNegativeInteger(charge.capturedAmount) &&
      charge.capturedAmount > charge.amount) {
    violations.push(violation(id, "CAPTURE_EXCEEDS_AMOUNT", "capturedAmount exceeds amount"));
  }
  if (validNonNegativeInteger(charge.capturedAmount) &&
      validNonNegativeInteger(charge.refundedAmount) &&
      charge.refundedAmount > charge.capturedAmount) {
    violations.push(
      violation(id, "REFUND_EXCEEDS_CAPTURE", "refundedAmount exceeds capturedAmount"),
    );
  }

  switch (charge.status) {
    case "pending":
      if (charge.capturedAmount !== 0 || charge.refundedAmount !== 0) {
        violations.push(violation(id, "PENDING_HAS_FUNDS", "pending charge cannot have captured or refunded funds"));
      }
      break;
    case "authorized":
      if (charge.capturedAmount !== 0 || charge.refundedAmount !== 0) {
        violations.push(violation(id, "AUTHORIZED_HAS_FUNDS", "authorized charge cannot have captured or refunded funds"));
      }
      break;
    case "captured":
      if (charge.capturedAmount <= 0 || charge.refundedAmount !== 0) {
        violations.push(violation(id, "CAPTURED_HAS_NO_CAPTURE", "captured charge must have a positive capture and no refund"));
      }
      break;
    case "partially_refunded":
      if (charge.refundedAmount <= 0 || charge.refundedAmount >= charge.capturedAmount) {
        violations.push(violation(id, "PARTIAL_REFUND_BALANCE", "partially refunded charge must refund less than its capture"));
      }
      break;
    case "refunded":
      if (charge.capturedAmount <= 0 || charge.refundedAmount !== charge.capturedAmount) {
        violations.push(violation(id, "REFUNDED_BALANCE", "refunded charge must refund its complete capture"));
      }
      break;
    case "failed":
      if (charge.capturedAmount !== 0 || charge.refundedAmount !== 0) {
        violations.push(violation(id, "FAILED_HAS_FUNDS", "failed charge cannot have captured or refunded funds"));
      }
      break;
    default:
      violations.push(violation(id, "INVALID_ID", "charge status is not recognized"));
  }

  return violations;
}

function compareViolations(left: ChargeViolation, right: ChargeViolation): number {
  return left.chargeId.localeCompare(right.chargeId) ||
    left.code.localeCompare(right.code) ||
    left.reason.localeCompare(right.reason);
}

function inspectChunk(
  chunk: readonly ChargeRecord[],
  seenIds: Set<string>,
): ChargeViolation[] {
  const violations: ChargeViolation[] = [];
  for (const charge of chunk) {
    const current = checkChargeInvariants(charge);
    if (seenIds.has(charge.id)) {
      current.push(violation(charge.id, "DUPLICATE_ID", "charge id appeared more than once in the scan"));
    }
    seenIds.add(charge.id);
    violations.push(...current);
  }
  return violations;
}

/** Scans at most `maxRecords` records without repairing or rewriting data. */
export function reconcileCharges(
  charges: Iterable<ChargeRecord>,
  options: ReconciliationOptions = {},
): ReconciliationReport {
  const maxRecords = boundedInteger(options.maxRecords, DEFAULT_MAX_RECORDS, MAX_MAX_RECORDS);
  const chunkSize = boundedInteger(options.chunkSize, DEFAULT_CHUNK_SIZE, MAX_CHUNK_SIZE);
  const iterator = charges[Symbol.iterator]();
  const seenIds = new Set<string>();
  const violations: ChargeViolation[] = [];
  let scanned = 0;
  let chunk: ChargeRecord[] = [];

  while (scanned < maxRecords) {
    const next = iterator.next();
    if (next.done) break;
    chunk.push(next.value);
    scanned += 1;
    if (chunk.length === chunkSize) {
      violations.push(...inspectChunk(chunk, seenIds));
      chunk = [];
    }
  }
  if (chunk.length > 0) violations.push(...inspectChunk(chunk, seenIds));

  const truncated = scanned === maxRecords && !iterator.next().done;
  violations.sort(compareViolations);
  const offendingIds = [...new Set(violations.map((entry) => entry.chargeId))].sort((a, b) =>
    a.localeCompare(b),
  );
  return {
    scanned,
    maxRecords,
    chunkSize,
    truncated,
    violationCount: violations.length,
    offendingIds,
    violations,
  };
}

/** Callable job entry point for the current in-memory charge ledger. */
export function runChargeReconciliation(
  options: ReconciliationOptions = {},
): ReconciliationReport {
  return reconcileCharges(chargeStore.values(), options);
}
