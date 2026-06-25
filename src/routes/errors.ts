import {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { getRequestId } from "../types.js";

type BodyParserError = Error & {
  type?: string;
  status?: number;
  statusCode?: number;
};

function isBodyParserError(err: unknown): err is BodyParserError {
  if (!(err instanceof Error)) return false;
  const candidate = err as BodyParserError;
  return (
    candidate.type === "entity.parse.failed" ||
    (err instanceof SyntaxError &&
      (candidate.status === 400 || candidate.statusCode === 400))
  );
}

/**
 * Installs the terminal 404 and error handlers after all route modules.
 */
export function installErrorHandlers(app: Application): void {
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      error: "not_found",
      message: `No route for ${req.method} ${req.path}`,
      requestId: getRequestId(req),
    });
  });

  /**
   * Converts body-parser failures into stable client errors before falling back
   * to the generic server-error envelope.
   */
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (isBodyParserError(err)) {
      res.status(400).json({
        error: "invalid_request",
        message: "Malformed JSON request body",
        requestId: getRequestId(req),
      });
      return;
    }

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
    const message = err instanceof Error ? err.message : "Unexpected server error";
    res.status(500).json({
      error: "internal_error",
      message,
      method: req.method,
      path: req.path,
      requestId: getRequestId(req),
    });
  });
}
