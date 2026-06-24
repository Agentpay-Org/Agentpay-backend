import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { type AppEvent, recordEvent } from "../events.js";
import { webhookStore } from "../store/state.js";
import { getRequestId } from "../types.js";
import { createWebhookSecret, deliverSingleWebhook } from "../webhooks/deliver.js";

const publicWebhook = (
  id: string,
  meta: {
    url: string;
    events: string[];
    createdAt: number;
    deadLetters: number;
  }
) => ({
  id,
  url: meta.url,
  events: meta.events,
  createdAt: meta.createdAt,
  deadLetters: meta.deadLetters,
});

const testWebhook = async (req: Request, res: Response) => {
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
  const event: AppEvent = {
    id: randomUUID(),
    ts: Date.now(),
    type: "webhook.test",
    payload: { id, url: hook.url },
  };
  const delivery = await deliverSingleWebhook(id, hook, event);
  recordEvent("webhook.test", {
    id,
    url: hook.url,
    delivered: delivery.delivered,
    attempts: delivery.attempts,
  });
  res.json({ id, deliveredAt: Date.now(), ...delivery });
};

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
    const items = Array.from(webhookStore.entries()).map(([id, meta]) =>
      publicWebhook(id, meta)
    );
    res.json({ items });
  });

  router.post("/api/v1/webhooks/:id/test", (req: Request, res: Response) => {
    void testWebhook(req, res);
  });

  router.patch("/api/v1/webhooks/:id", (req: Request, res: Response) => {
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
      if (typeof url !== "string" || !/^https?:\/\//.test(url) || url.length > 2048) {
        res.status(400).json({
          error: "invalid_request",
          message: "url must be an http(s) URL up to 2048 chars",
          requestId,
        });
        return;
      }
      existing.url = url;
    }
    if (events !== undefined) {
      if (
        !Array.isArray(events) ||
        events.length === 0 ||
        events.some((e) => typeof e !== "string")
      ) {
        res.status(400).json({
          error: "invalid_request",
          message: "events must be a non-empty array of strings",
          requestId,
        });
        return;
      }
      existing.events = events;
    }
    webhookStore.set(id, existing);
    res.json(publicWebhook(id, existing));
  });

  router.post("/api/v1/webhooks", (req: Request, res: Response) => {
    const { url, events } = req.body ?? {};
    const requestId = getRequestId(req);
    if (typeof url !== "string" || !/^https?:\/\//.test(url) || url.length > 2048) {
      res.status(400).json({
        error: "invalid_request",
        message: "url must be an http(s) URL up to 2048 chars",
        requestId,
      });
      return;
    }
    if (
      !Array.isArray(events) ||
      events.length === 0 ||
      events.some((e) => typeof e !== "string")
    ) {
      res.status(400).json({
        error: "invalid_request",
        message: "events must be a non-empty array of strings",
        requestId,
      });
      return;
    }
    const id = `wh_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const secret = createWebhookSecret();
    webhookStore.set(id, {
      url,
      events,
      createdAt: Date.now(),
      secret,
      deadLetters: 0,
    });
    res.status(201).json({ id, url, events, secret });
  });

  return router;
}
