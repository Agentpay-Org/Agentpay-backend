import type { NextFunction, Request, Response } from "express";
import {
  PaymentDomainError,
  paymentInternalError,
  paymentRequestId,
} from "../errors/domainError.js";

/**
 * Maps every payment failure to the one public error envelope.
 *
 * Internal causes are retained on the error for logging, but never copied into
 * the HTTP response. `error` remains as a compatibility alias; new clients
 * should branch on `code`.
 */
export function paymentErrorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const domainError =
    error instanceof PaymentDomainError ? error : paymentInternalError(error);

  if (!(error instanceof PaymentDomainError)) {
    console.error(
      JSON.stringify({
        event: "payment_error",
        code: domainError.code,
        requestId: paymentRequestId(req),
        method: req.method,
        path: req.path,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    );
  }

  res.status(domainError.status).json({
    code: domainError.code,
    error: domainError.code,
    message: domainError.message,
    requestId: paymentRequestId(req),
  });
}
