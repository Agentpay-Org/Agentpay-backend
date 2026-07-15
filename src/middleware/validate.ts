import type { NextFunction, Request, Response } from "express";
import type { BodySchema } from "../schemas/requestBodies.js";
import { getRequestId } from "../types.js";

/**
 * Validates JSON request bodies before a route handler sees them.
 */
export function validateBody(schema: BodySchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req.body);
    if (!parsed.ok) {
      res.status(400).json({
        error: "invalid_request",
        message: parsed.message,
        requestId: getRequestId(req),
      });
      return;
    }

    req.body = parsed.value;
    next();
  };
}
