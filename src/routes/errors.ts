import {
  type Application,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { getRequestId } from "../types.js";

const INTERNAL_ERROR_MESSAGE = "Unexpected server error";

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
   * Logs unexpected internal errors with request context while returning a
   * fixed client-facing message so implementation details stay server-side.
   */
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
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

    const requestId = getRequestId(req);
    console.error(
      JSON.stringify({
        requestId,
        method: req.method,
        path: req.path,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
    );

    res.status(500).json({
      error: "internal_error",
      message: INTERNAL_ERROR_MESSAGE,
      method: req.method,
      path: req.path,
      requestId,
    });
  });
}
