import { Buffer } from "node:buffer";
import { Router, type Request, type Response } from "express";
import { EVENT_LOG_CAP, eventLog } from "../events.js";
import { etagFor } from "../httpCache.js";

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
    const items = eventLog
      .filter((e) => e.ts >= since && (type === undefined || e.type === type))
      .slice(-limit);
    const bodyShape = { items };
    const body = JSON.stringify(bodyShape);
    const etag = etagFor({
      body: bodyShape,
      query: { limit, since, type: type ?? null },
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
