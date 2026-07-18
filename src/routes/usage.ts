import { Router, type Request, type Response } from "express";
import { isValidAgentId, isValidServiceId } from "../identifiers.js";
import { recordEvent } from "../events.js";
import { createIdempotencyMiddleware } from "../middleware/idempotency.js";
import { validateBody } from "../middleware/validate.js";
import {
  config,
  lifetimeRequests,
  parseUsageKey,
  serviceKey,
  servicesDisabled,
  servicesStore,
  usageKey,
  usageStore,
} from "../store/state.js";
import { resolveTenantId } from "../tenant.js";
import { getRequestId } from "../types.js";
import { multiplyStroops } from "../util/stroops.js";
import { requestBodySchemas } from "../schemas/index.js";

type BulkUsageResult = {
  index: number;
  ok: boolean;
  total?: number;
  error?: string;
};

type BulkUsageBody = {
  items: Array<{ agent: string; serviceId: string; requests: number }>;
};

function invalidIdentifierMessage(kind: "agent" | "serviceId"): string {
  const max = kind === "agent" ? 256 : 128;
  return `${kind} must be 1-${max} chars using only letters, numbers, dot, underscore, or hyphen`;
}

export function createUsageRouter(): Router {
  const router = Router();
  const idempotency = createIdempotencyMiddleware();

  router.post("/api/v1/usage", idempotency, (req: Request, res: Response) => {
    const { agent, serviceId, requests } = req.body ?? {};
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);

    if (!isValidAgentId(agent)) {
      res.status(400).json({
        error: "invalid_request",
        message: invalidIdentifierMessage("agent"),
        requestId,
      });
      return;
    }
    if (!isValidServiceId(serviceId)) {
      res.status(400).json({
        error: "invalid_request",
        message: invalidIdentifierMessage("serviceId"),
        requestId,
      });
      return;
    }
    if (typeof requests !== "number" || !Number.isInteger(requests) || requests <= 0) {
      res.status(400).json({
        error: "invalid_request",
        message: "requests must be a positive integer",
        requestId,
      });
      return;
    }

    if (servicesDisabled.has(serviceKey(tenantId, serviceId))) {
      res.status(409).json({
        error: "service_disabled",
        message: `service ${serviceId} is currently disabled`,
        requestId,
      });
      return;
    }

    const key = usageKey(tenantId, agent, serviceId);
    const prev = usageStore.get(key) ?? 0;
    const total = Math.min(Number.MAX_SAFE_INTEGER, prev + requests);
    usageStore.set(key, total);
    lifetimeRequests = Math.min(Number.MAX_SAFE_INTEGER, lifetimeRequests + requests);

    recordEvent("usage.recorded", { agent, serviceId, requests, total });
    res.status(201).json({ agent, serviceId, total });
  });

  /**
   * Records usage for up to config.bulkMaxItems agent/service pairs in a single
   * batch.  The active limit is controlled by PATCH /api/v1/config (default 100,
   * max 1000).  Invalid items are reported individually without failing the rest.
   */
  router.post(
    "/api/v1/usage/bulk",
    idempotency,
    validateBody(requestBodySchemas.bulkUsage),
    (req: Request, res: Response) => {
      const requestId = getRequestId(req);
      const tenantId = resolveTenantId(req);
      const { items } = req.body as BulkUsageBody;
      if (items.length > config.bulkMaxItems) {
        res.status(400).json({
          error: "invalid_request",
          message: `items must be a non-empty array of up to ${config.bulkMaxItems} entries`,
          requestId,
        });
        return;
      }
      const results: BulkUsageResult[] = [];
      for (let i = 0; i < items.length; i++) {
        const { agent, serviceId, requests } = items[i] ?? {};

        if (
          !isValidAgentId(agent) ||
          !isValidServiceId(serviceId) ||
          typeof requests !== "number" ||
          !Number.isInteger(requests) ||
          requests <= 0
        ) {
          results.push({ index: i, ok: false, error: "invalid_item" });
          continue;
        }
        const key = usageKey(tenantId, agent, serviceId);
        const total = Math.min(
          Number.MAX_SAFE_INTEGER,
          (usageStore.get(key) ?? 0) + requests
        );
        usageStore.set(key, total);
        lifetimeRequests = Math.min(Number.MAX_SAFE_INTEGER, lifetimeRequests + requests);
        recordEvent("usage.recorded", {
          agent,
          serviceId,
          requests,
          total,
          bulk: true,
        });
        results.push({ index: i, ok: true, total });
      }

      res.status(201).json({ results });
    }
  );

  router.post("/api/v1/settle", idempotency, (req: Request, res: Response) => {
    const { agent, serviceId } = req.body ?? {};
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    if (typeof agent !== "string" || typeof serviceId !== "string") {
      res.status(400).json({
        error: "invalid_request",
        message: "agent and serviceId must be safe identifiers",
        requestId,
      });
      return;
    }
    const key = usageKey(tenantId, agent, serviceId);
    const requests = usageStore.get(key) ?? 0;
    const price = servicesStore.get(serviceKey(tenantId, serviceId))?.priceStroops ?? 0;
    const billedStroops = requests * price;
    usageStore.set(key, 0);
    recordEvent("usage.settled", { agent, serviceId, requests, billedStroops });
    res.json({ agent, serviceId, requests, priceStroops: price, billedStroops });
  });

  // ... (other GET routes for usage, billing, agents - keep them as they were or add if missing)

  return router;
}