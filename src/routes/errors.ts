import {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { recordHttpError } from "../metrics.js";
import { getRequestId } from "../types.js";

type ExpressError = Error & {
  body?: unknown;
  status?: number;
  statusCode?: number;
  type?: string;
};

function requestIdForError(req: Request): string | undefined {
  const middlewareId = getRequestId(req);
  if (middlewareId) return middlewareId;

  const incoming = req.header("x-request-id");
  return incoming && incoming.length <= 200 ? incoming : undefined;
}

function isPayloadTooLargeError(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === "object" &&
    "type" in err &&
    (err as ExpressError).type === "entity.too.large"
  );
}

function isMalformedJsonError(err: unknown): boolean {
  if (!(err instanceof SyntaxError)) return false;
  const expressError = err as ExpressError;
  return (
    expressError.type === "entity.parse.failed" ||
    expressError.status === 400 ||
    expressError.statusCode === 400
  );
}

function logInternalError(
  err: unknown,
  req: Request,
  requestId: string | undefined
): void {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(
    JSON.stringify({
      requestId,
      method: req.method,
      path: req.path,
      message: error.message,
      stack: error.stack,
    })
  );
}

/**
 * Installs the terminal 404 and error handlers after all route modules.
 */
export function installErrorHandlers(app: Application): void {
  app.use((req: Request, res: Response) => {
    const requestId = requestIdForError(req);
    res.status(404).json({
      error: "not_found",
      message: `No route for ${req.method} ${req.path}`,
      requestId,
    });
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    recordHttpError(errorType(err));
    if (
      err &&
      typeof err === "object" &&
      "type" in err &&
      (err as { type: string }).type === "entity.too.large"
    ) {
      res.status(413).json({
        error: "payload_too_large",
        message: "request body exceeds the 100 KiB limit",
        requestId: getRequestId(req),
      });
      return;
    }

    if (isPayloadTooLargeError(err)) {
      res.status(413).json({
        error: "payload_too_large",
        message: "request body exceeds the 100 KiB limit",
        requestId: getRequestId(req),
      });
      return;
    }

    if (isMalformedJsonError(err)) {
      res.status(400).json({
        error: "invalid_request",
        message: "Malformed JSON in request body",
        requestId: requestIdForError(req),
      });
      return;
    }

    logInternalError(err, req, requestIdForError(req));
    res.status(500).json({
      error: "internal_error",
      message: "Unexpected server error",
      method: req.method,
      path: req.path,
      requestId: requestIdForError(req),
    });
  });
}

function errorType(err: unknown): string {
  if (err && typeof err === "object" && "type" in err) {
    const type = (err as { type: unknown }).type;
    if (typeof type === "string" && type.length > 0) {
      return type;
    }
  }
  if (err instanceof Error && err.name.length > 0) {
    return err.name;
  }
  return "unknown";
}
