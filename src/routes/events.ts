import { Router, type Request, type Response } from "express";
import { type AppEvent, eventLog } from "../events.js";
import { etagFor } from "../httpCache.js";
import { parseIntParam } from "../queryParams.js";
import { config } from "../store/state.js";
import { getRequestId } from "../types.js";

/** Encodes an event log boundary into an opaque backward-paging cursor. */
function encodeCursor(event: AppEvent): string {
  return Buffer.from(`${event.ts}:${event.id}`).toString("base64url");
}

/** Decodes a paging cursor, returning null when it is not well formed. */
function decodeCursor(raw: string): { ts: number; id: string } | null {
  let decoded: string;
  try {
    decoded = Buffer.from(raw, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const separator = decoded.indexOf(":");
  if (separator === -1) return null;
  const ts = Number(decoded.slice(0, separator));
  const id = decoded.slice(separator + 1);
  if (!Number.isInteger(ts) || id.length === 0) return null;
  return { ts, id };
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
    const since = parseIntParam(req.query.since, {
      defaultValue: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const limit = parseIntParam(req.query.limit, {
      defaultValue: 100,
      min: 1,
      max: config.eventLogCap,
    });
    const cursorRaw =
      typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const filtered = eventLog.filter(
      (e) => e.ts >= since && (type === undefined || e.type === type)
    );

    let scope = filtered;
    if (cursorRaw !== undefined) {
      const decoded = decodeCursor(cursorRaw);
      if (!decoded) {
        res.status(400).json({
          error: "invalid_request",
          message: "cursor is malformed",
          requestId: getRequestId(req),
        });
        return;
      }
      const index = filtered.findIndex(
        (e) => e.id === decoded.id && e.ts === decoded.ts
      );
      if (index === -1) {
        res.status(400).json({
          error: "invalid_request",
          message: "cursor is invalid or expired",
          requestId: getRequestId(req),
        });
        return;
      }
      scope = filtered.slice(0, index);
    }

    const items = scope.slice(-limit);
    const total = filtered.length;
    const nextCursor =
      scope.length > items.length && items.length > 0
        ? encodeCursor(items[0])
        : null;

    const bodyShape = { total, items, nextCursor };
    const body = JSON.stringify(bodyShape);
    const etag = etagFor({
      body: bodyShape,
      query: { limit, since, type: type ?? null, cursor: cursorRaw ?? null },
    });
    if (req.header("if-none-match") === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader("ETag", etag);
    res.type("application/json").send(body);
  });

  return router;
}
