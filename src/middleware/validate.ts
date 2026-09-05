import type { NextFunction, Request, Response } from "express";
import type { BodySchema } from "../schemas/requestBodies.js";
import { getRequestId } from "../types.js";

/**
 * Rejects requests carrying query parameters outside the given allow-list
 * with a structured 400, instead of silently ignoring typos and stray
 * fields the way unbounded `req.query` reads otherwise would.
 */
export function rejectUnknownQueryParams(allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  return (req: Request, res: Response, next: NextFunction): void => {
    const unknown = Object.keys(req.query).filter((key) => !allowedSet.has(key));
    if (unknown.length > 0) {
      res.status(400).json({
        error: "invalid_request",
        message: `unexpected query parameter: ${unknown[0]}`,
        requestId: getRequestId(req),
      });
      return;
    }
    next();
  };
}

/**
 * Validates JSON request bodies before a route handler sees them.
 */
export function validateBody(schema: BodySchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req.body);
    if (!parsed.ok) {
      res.status(400).json({
        error: "validation_error",
        message: parsed.message,
        ...(parsed.details && { details: parsed.details }),
        requestId: getRequestId(req),
      });
      return;
    }

    req.body = parsed.value;
    next();
  };
}
