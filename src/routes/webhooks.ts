import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { recordEvent } from "../events.js";
import { validateBody } from "../middleware/validate.js";
import { requestBodySchemas } from "../schemas/requestBodies.js";
import { webhookStore } from "../store/state.js";
import { getRequestId } from "../types.js";

/**
 * Builds webhook registration, update, deletion, and synthetic test routes.
 */
export function createWebhooksRouter(): Router {
  const router = Router();

  router.delete("/api/v1/webhooks/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    if (!webhookStore.has(id)) {
      res.status(404).json({
        error: "not_found",
        message: `webhook ${id} not registered`,
        requestId: getRequestId(req),
      });
      return;
    }
    webhookStore.delete(id);
    res.status(204).send();
  });

  router.get("/api/v1/webhooks", (_req, res: Response) => {
    const items = Array.from(webhookStore.entries()).map(([id, meta]) => ({
      id,
      ...meta,
    }));
    res.json({ items });
  });

  router.post("/api/v1/webhooks/:id/test", (req: Request, res: Response) => {
    const { id } = req.params;
    const requestId = getRequestId(req);
    const hook = webhookStore.get(id);
    if (!hook) {
      res.status(404).json({
        error: "not_found",
        message: `webhook ${id} not registered`,
        requestId,
      });
      return;
    }
    recordEvent("webhook.test", { id, url: hook.url });
    res.json({ id, deliveredAt: Date.now(), simulated: true });
  });

  router.patch(
    "/api/v1/webhooks/:id",
    validateBody(requestBodySchemas.webhookPatch),
    (req: Request, res: Response) => {
      const { id } = req.params;
      const requestId = getRequestId(req);
      const existing = webhookStore.get(id);
      if (!existing) {
        res.status(404).json({
          error: "not_found",
          message: `webhook ${id} not registered`,
          requestId,
        });
        return;
      }
      const { url, events } = req.body ?? {};
      if (url !== undefined) {
        existing.url = url;
      }
      if (events !== undefined) {
        existing.events = events;
      }
      webhookStore.set(id, existing);
      res.json({ id, ...existing });
    }
  );

  router.post(
    "/api/v1/webhooks",
    validateBody(requestBodySchemas.webhookCreate),
    (req: Request, res: Response) => {
      const { url, events } = req.body ?? {};
      const id = `wh_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      webhookStore.set(id, { url, events, createdAt: Date.now() });
      res.status(201).json({ id, url, events });
    }
  );

  return router;
}
