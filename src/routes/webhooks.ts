import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { recordEvent } from "../events.js";
import { parsePagination } from "../pagination.js";
import { webhookStore } from "../store/state.js";
import { getRequestId } from "../types.js";

const SUBSCRIBABLE_EVENT_TYPES = new Set<string>([...KNOWN_EVENT_TYPES, "*"]);

function readWebhookBody(req: Request): { url?: unknown; events?: unknown } {
  const body: unknown = req.body;
  if (!body || typeof body !== "object") {
    return {};
  }
  const fields = body as Record<string, unknown>;
  return { url: fields.url, events: fields.events };
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string")
  );
}

/** Returns the first webhook event name outside the documented taxonomy. */
function findUnknownWebhookEvent(events: string[]): string | undefined {
  return events.find((event) => !SUBSCRIBABLE_EVENT_TYPES.has(event));
}

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

  /** Lists registered webhooks with bounded offset pagination. */
  router.get("/api/v1/webhooks", (req: Request, res: Response) => {
    const { limit, offset } = parsePagination(req.query);
    const allItems = Array.from(webhookStore.entries())
      .sort(
        ([idA, metaA], [idB, metaB]) =>
          metaA.createdAt - metaB.createdAt || idA.localeCompare(idB)
      )
      .map(([id, meta]) => ({
        id,
        ...meta,
      }));
    const items = allItems.slice(offset, offset + limit);
    res.json({ items, total: allItems.length });
  });

  router.get("/api/v1/webhooks/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    const hook = webhookStore.get(id);
    if (!hook) {
      res.status(404).json({
        error: "not_found",
        message: `webhook ${id} not registered`,
        requestId: getRequestId(req),
      });
      return;
    }
    res.json({ id, ...hook });
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
    const { url, events } = readWebhookBody(req);
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
      if (!isNonEmptyStringArray(events)) {
        res.status(400).json({
          error: "invalid_request",
          message: "events must be a non-empty array of strings",
          requestId,
        });
        return;
      }
      const unknownEvent = findUnknownWebhookEvent(events);
      if (unknownEvent) {
        res.status(400).json({
          error: "invalid_request",
          message: `unknown webhook event: ${unknownEvent}`,
          requestId,
        });
        return;
      }
      existing.events = events;
    }
    webhookStore.set(id, existing);
    res.json({ id, ...existing });
  });

  router.post("/api/v1/webhooks", (req: Request, res: Response) => {
    const { url, events } = readWebhookBody(req);
    const requestId = getRequestId(req);
    if (typeof url !== "string" || !/^https?:\/\//.test(url) || url.length > 2048) {
      res.status(400).json({
        error: "invalid_request",
        message: "url must be an http(s) URL up to 2048 chars",
        requestId,
      });
      return;
    }
    if (!isNonEmptyStringArray(events)) {
      res.status(400).json({
        error: "invalid_request",
        message: "events must be a non-empty array of strings",
        requestId,
      });
      return;
    }
    const unknownEvent = findUnknownWebhookEvent(events);
    if (unknownEvent) {
      res.status(400).json({
        error: "invalid_request",
        message: `unknown webhook event: ${unknownEvent}`,
        requestId,
      });
      return;
    }
    const id = `wh_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    if (!hasCapacityForNewKey(webhookStore, id, "webhookStoreMaxKeys")) {
      res
        .status(429)
        .json(storeCapacityError("webhookStore", "webhookStoreMaxKeys", requestId));
      return;
    }
    webhookStore.set(id, { url, events, createdAt: Date.now() });
    res.status(201).json({ id, url, events });
  });

  return router;
}
