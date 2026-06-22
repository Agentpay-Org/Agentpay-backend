import type { NextFunction, Request, RequestHandler, Response } from "express";

type ErrorCode =
  | "invalid_request"
  | "not_found"
  | "service_disabled"
  | "service_paused"
  | "payload_too_large"
  | "rate_limited";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => void | Promise<void>;

/**
 * Typed operational error rendered by the final Express error handler.
 *
 * AppError carries the HTTP status and public error code that are safe to
 * return to callers. Stack traces and internal details are intentionally not
 * serialized.
 */
class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }

  /** 400 invalid request from malformed or unsupported client input. */
  static badRequest(message: string) {
    return new AppError(400, "invalid_request", message);
  }

  /** 404 when an endpoint or requested resource does not exist. */
  static notFound(message: string) {
    return new AppError(404, "not_found", message);
  }

  /** 409 conflict, with a specific public code when the domain needs one. */
  static conflict(message: string, code: "service_disabled" = "service_disabled") {
    return new AppError(409, code, message);
  }

  /** 503 while writes are paused by the admin control plane. */
  static paused(message: string) {
    return new AppError(503, "service_paused", message);
  }

  /** 413 when express.json rejects a request body above the configured cap. */
  static payloadTooLarge(message: string) {
    return new AppError(413, "payload_too_large", message);
  }

  /** 429 when a caller exceeds the in-process rate limit. */
  static rateLimited(message: string) {
    return new AppError(429, "rate_limited", message);
  }
}

function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    try {
      void Promise.resolve(handler(req, res, next)).catch(next);
    } catch (err) {
      next(err);
    }
  };
}

function renderAppError(err: AppError, req: Request, res: Response) {
  res.status(err.status).json({
    error: err.code,
    message: err.message,
    requestId: req.id,
  });
}

function renderInternalError(err: unknown, req: Request, res: Response) {
  const message = err instanceof Error ? err.message : "Unexpected server error";
  res.status(500).json({
    error: "internal_error",
    message,
    method: req.method,
    path: req.path,
    requestId: req.id,
  });
}

export { AppError, asyncHandler, renderAppError, renderInternalError };
