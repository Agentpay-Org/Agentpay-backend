import { Router, type Request, type Response } from "express";
import { EVENT_LOG_CAP, listEvents, summarizeEvents } from "../events.js";

/**
 * Builds read-only audit-event routes.
 */
export function createEventsRouter(): Router {
  const router = Router();

  router.get("/api/v1/events/summary", (_req, res: Response) => {
    res.json(summarizeEvents());
  });

  router.get("/api/v1/events", (req: Request, res: Response) => {
    const since = Number((req.query.since as string) ?? 0);
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const limit = Math.min(
      EVENT_LOG_CAP,
      Math.max(1, Number((req.query.limit as string) ?? 100))
    );
    res.json({ items: listEvents({ limit, since, type }) });
  });

  return router;
}
