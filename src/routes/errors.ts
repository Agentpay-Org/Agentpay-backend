import {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { recordHttpError } from "../metrics.js";
import { getRequestId } from "../types.js";

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
