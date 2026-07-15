import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { recordEvent } from "../events.js";
import { parsePagination } from "../pagination.js";
import { webhookStore } from "../store/state.js";
import { getRequestId } from "../types.js";

export type WebhookValidationResult<T> =
  { ok: true; value: T } | { ok: false; message: string };

/**
 * Validates the URL rule shared by webhook create and patch routes.
 */
export function validateWebhookUrl(url: unknown): WebhookValidationResult<string> {
  if (typeof url !== "string" || !/^https?:\/\//.test(url) || url.length > 2048) {
    return {
      ok: false,
      message: "url must be an http(s) URL up to 2048 chars",
    };
  }

  return { ok: true, value: url };
}

/**
 * Validates the event subscription rule shared by webhook create and patch routes.
 */
export function validateWebhookEvents(
  events: unknown
): WebhookValidationResult<string[]> {
  if (
    !Array.isArray(events) ||
    events.length === 0 ||
    events.some((event) => typeof event !== "string")
  ) {
    return {
      ok: false,
      message: "events must be a non-empty array of strings",
    };
  }

  return { ok: true, value: events as string[] };
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
      const validatedUrl = validateWebhookUrl(url);
      if (!validatedUrl.ok) {
        res.status(400).json({
          error: "invalid_request",
          message: validatedUrl.message,
          requestId,
        });
        return;
      }
      existing.url = validatedUrl.value;
    }
    if (events !== undefined) {
      const validatedEvents = validateWebhookEvents(events);
      if (!validatedEvents.ok) {
        res.status(400).json({
          error: "invalid_request",
          message: validatedEvents.message,
          requestId,
        });
        return;
      }
      existing.events = validatedEvents.value;
    }
    webhookStore.set(id, existing);
    res.json({ id, ...existing });
  });

  router.post("/api/v1/webhooks", (req: Request, res: Response) => {
    const { url, events } = readWebhookBody(req);
    const requestId = getRequestId(req);
    const validatedUrl = validateWebhookUrl(url);
    if (!validatedUrl.ok) {
      res.status(400).json({
        error: "invalid_request",
        message: validatedUrl.message,
        requestId,
      });
      return;
    }
    const validatedEvents = validateWebhookEvents(events);
    if (!validatedEvents.ok) {
      res.status(400).json({
        error: "invalid_request",
        message: validatedEvents.message,
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
    webhookStore.set(id, {
      url: validatedUrl.value,
      events: validatedEvents.value,
      createdAt: Date.now(),
    });
    res.status(201).json({
      id,
      url: validatedUrl.value,
      events: validatedEvents.value,
    });
  });

  return router;
}
