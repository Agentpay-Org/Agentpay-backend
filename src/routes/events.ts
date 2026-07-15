import { Buffer } from "node:buffer";
import { Router, type Request, type Response } from "express";
import { EVENT_LOG_CAP, eventLog, type AppEvent } from "../events.js";
import { getRequestId } from "../types.js";

type EventCursor = {
  ts: number;
  id: string;
};

/**
 * Encodes the current page boundary without exposing pagination internals.
 */
function encodeEventCursor(event: AppEvent): string {
  return Buffer.from(`${event.ts}:${event.id}`, "utf8").toString("base64url");
}

/**
 * Decodes and validates an event-log cursor supplied by a client.
 */
function decodeEventCursor(value: string): EventCursor | undefined {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator <= 0 || separator === decoded.length - 1) return undefined;
    const ts = Number(decoded.slice(0, separator));
    const id = decoded.slice(separator + 1);
    if (!Number.isFinite(ts) || !id) return undefined;
    return { ts, id };
  } catch {
    return undefined;
  }
}

/**
 * Builds read-only audit-event routes.
 */
export function createEventsRouter(): Router {
  const router = Router();

  router.get("/api/v1/events/summary", (_req, res: Response) => {
    const counts: Record<string, number> = {};
    for (const e of eventLog) counts[e.type] = (counts[e.type] ?? 0) + 1;
    res.json({ counts, total: eventLog.length });
  });

  router.get("/api/v1/events", (req: Request, res: Response) => {
    const since = Number((req.query.since as string) ?? 0);
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const limit = Math.min(
      getEventLogCap(),
      Math.max(1, Number((req.query.limit as string) ?? 100))
    );
    const cursorValue =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const cursor = cursorValue ? decodeEventCursor(cursorValue) : undefined;
    if (cursorValue && !cursor) {
      res.status(400).json({
        error: "invalid_request",
        message: "cursor is malformed",
        requestId: getRequestId(req),
      });
      return;
    }

    const matches = eventLog.filter(
      (e) => e.ts >= since && (type === undefined || e.type === type)
    );
    const total = matches.length;
    let end = matches.length;
    if (cursor) {
      end = matches.findIndex(
        (event) => event.ts === cursor.ts && event.id === cursor.id
      );
      if (end === -1) {
        res.status(400).json({
          error: "invalid_request",
          message: "cursor was not found or has expired",
          requestId: getRequestId(req),
        });
        return;
      }
    }

    const start = Math.max(0, end - limit);
    const items = matches.slice(start, end);
    const nextCursor = start > 0 ? encodeEventCursor(items[0]) : null;
    res.json({ items, nextCursor, total });
  });

  return router;
}
