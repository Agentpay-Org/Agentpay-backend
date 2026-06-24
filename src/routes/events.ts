import { Router, type Request, type Response } from "express";
import { EVENT_LOG_CAP, eventLog } from "../events.js";
import { parseIntParam } from "../queryParams.js";

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
      default: 0,
      min: 0,
      max: Number.MAX_SAFE_INTEGER,
    });
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const limit = parseIntParam(req.query.limit, {
      default: 100,
      min: 1,
      max: EVENT_LOG_CAP,
    });
    const items = eventLog
      .filter((e) => e.ts >= since && (type === undefined || e.type === type))
      .slice(-limit);
    res.json({ items });
  });

  return router;
}
