import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { recordEvent } from "../events.js";
import { validateBody } from "../middleware/validate.js";
import { requestBodySchemas } from "../schemas/requestBodies.js";
import { webhookStore } from "../store/state.js";
import { getRequestId } from "../types.js";
import { KNOWN_EVENT_TYPES } from "../events.js";

export type WebhookValidationResult<T> = 
  { ok: true; value: T } | { ok: false; message: string };

export function validateWebhookUrl(url: unknown): WebhookValidationResult<string> {
  if (typeof url !== "string" || url.length > 2048 || !/^https?:\/\//.test(url)) {
    return { ok: false, message: "url must be an http(s) URL up to 2048 chars" };
  }
  return { ok: true, value: url };
}

/**
 * Validates that the given events input is a non-empty array of strings,
 * and that every string represents a known event type or wildcard.
 */
export function validateWebhookEvents(
  events: unknown
): WebhookValidationResult<string[]> {
  if (!Array.isArray(events) || events.length === 0 || events.some((e) => typeof e !== "string")) {
    return { ok: false, message: "events must be a non-empty array of strings" };
  }
  const stringEvents = events as string[];
  for (const e of stringEvents) {
    if (!(KNOWN_EVENT_TYPES as readonly string[]).includes(e)) {
      return { ok: false, message: `unknown event type: ${e}` };
    }
  }
  return { ok: true, value: stringEvents };
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

  router.get("/api/v1/webhooks", (req: Request, res: Response) => {
    // Simplified pagination for now
    const allItems = Array.from(webhookStore.entries())
      .sort(([idA, metaA], [idB, metaB]) => 
        metaA.createdAt - metaB.createdAt || idA.localeCompare(idB)
      )
      .map(([id, meta]) => ({
        id,
        ...meta,
      }));
    res.json({ items: allItems, total: allItems.length });
  });

  /**
   * Fetches a single webhook by ID.
   *
   * Returns `{ id, url, events, createdAt }` — the same field shape as each
   * item in the `GET /api/v1/webhooks` list response — so callers can confirm
   * the result of a PATCH without re-listing every webhook.
   *
   * Responds with `404 not_found` (including a `requestId` for correlation)
   * when the ID is not registered or has already been deleted.
   */
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
    const hook = webhookStore.get(id);
    if (!hook) {
      res.status(404).json({
        error: "not_found",
        message: `webhook ${id} not registered`,
        requestId: getRequestId(req),
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

    const { url, events } = req.body ?? {};
    if (url === undefined && events === undefined) {
      res.status(400).json({
        error: "invalid_request",
        message: "at least one of url or events is required",
        requestId,
      });
      return;
    }

    if (url !== undefined) {
      const result = validateWebhookUrl(url);
      if (!result.ok) {
        res.status(400).json({
          error: "invalid_request",
          message: result.message,
          requestId,
        });
        return;
      }
      existing.url = result.value;
    }
    if (events !== undefined) {
      const result = validateWebhookEvents(events);
      if (!result.ok) {
        res.status(400).json({
          error: "invalid_request",
          message: result.message,
          requestId,
        });
        return;
      }
      existing.events = result.value;
    }
    webhookStore.set(id, existing);
    res.json({ id, ...existing });
  });

  router.post(
    "/api/v1/webhooks",
    validateBody(requestBodySchemas.webhookCreate),
    (req: Request, res: Response) => {
      const { url, events } = req.body ?? {};

      const eventValidation = validateWebhookEvents(events);
      if (!eventValidation.ok) {
        res.status(400).json({
          error: "invalid_request",
          message: eventValidation.message,
          requestId: getRequestId(req),
        });
        return;
      }

      const id = `wh_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
      webhookStore.set(id, { url, events: eventValidation.value, createdAt: Date.now() });
      res.status(201).json({ id, url, events: eventValidation.value });
    }
  );

  return router;
}