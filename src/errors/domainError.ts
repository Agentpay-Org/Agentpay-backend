import type { Request } from "express";
import { getRequestId } from "../types.js";

/**
 * The public payment error vocabulary. These values are deliberately stable:
 * clients should branch on `code`, not on human-readable text.
 */
export type PaymentErrorCode =
  | "invalid_request"
  | "not_found"
  | "idempotency_conflict"
  | "request_in_progress"
  | "internal_error";

type PaymentErrorOptions = {
  status: 400 | 404 | 409 | 500;
  message: string;
  cause?: unknown;
};

/** Typed domain failure used before the single payment error mapping point. */
export class PaymentDomainError extends Error {
  readonly code: PaymentErrorCode;
  readonly status: PaymentErrorOptions["status"];
  readonly cause?: unknown;

  constructor(code: PaymentErrorCode, options: PaymentErrorOptions) {
    super(options.message);
    this.name = "PaymentDomainError";
    this.code = code;
    this.status = options.status;
    this.cause = options.cause;
  }
}

export function paymentValidationError(
  message: string,
  cause?: unknown
): PaymentDomainError {
  return new PaymentDomainError("invalid_request", { status: 400, message, cause });
}

export function paymentNotFoundError(
  message: string,
  cause?: unknown
): PaymentDomainError {
  return new PaymentDomainError("not_found", { status: 404, message, cause });
}

export function paymentConflictError(
  message: string,
  cause?: unknown
): PaymentDomainError {
  return new PaymentDomainError("idempotency_conflict", {
    status: 409,
    message,
    cause,
  });
}

export function paymentInProgressError(
  message: string,
  cause?: unknown
): PaymentDomainError {
  return new PaymentDomainError("request_in_progress", { status: 409, message, cause });
}

export function paymentInternalError(cause?: unknown): PaymentDomainError {
  return new PaymentDomainError("internal_error", {
    status: 500,
    message: "Unexpected payment processing error",
    cause,
  });
}

/** Returns a correlation id even when the router is embedded without middleware. */
export function paymentRequestId(req: Request): string {
  return getRequestId(req) ?? req.header("x-request-id") ?? "unknown-request";
}
