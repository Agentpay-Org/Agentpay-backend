import { Router, type Request, type Response } from "express";
import { isValidServiceId } from "../identifiers.js";
import {
  config,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
} from "../store/state.js";
import { recordEvent } from "../events.js";
import { getRequestId } from "../types.js";
import { scanByService } from "../usageScan.js";

type ServiceReadShape = {
  serviceId: string;
  priceStroops: number;
  disabled: boolean;
  description?: string;
  owner?: string;
};

function invalidServiceIdMessage(): string {
  return "serviceId must be 1-128 chars using only letters, numbers, dot, underscore, or hyphen";
}

function rejectInvalidServicePath(
  req: Request,
  res: Response,
  serviceId: unknown
): boolean {
  if (isValidServiceId(serviceId)) return false;

  res.status(400).json({
    error: "invalid_request",
    message: invalidServiceIdMessage(),
    requestId: getRequestId(req),
  });
  return true;
}

/**
 * Builds the public read shape for service detail and list endpoints.
 */
function serviceReadShape(
  serviceId: string,
  storeKey: string,
  meta: { priceStroops: number }
): ServiceReadShape {
  const metadata = servicesMetadata.get(storeKey);
  return {
    serviceId,
    priceStroops: meta.priceStroops,
    disabled: servicesDisabled.has(storeKey),
    ...(metadata ?? {}),
  };
}

/** Validates service metadata for both inline registration and metadata updates. */
function validateServiceMetadata(
  description: unknown,
  owner: unknown
): { metadata: ServiceMetadataDto } | { message: string } {
  if (typeof description !== "string" || description.length > 256) {
    return { message: "description must be a string up to 256 chars" };
  }
  if (typeof owner !== "string" || owner.length === 0 || owner.length > 256) {
    return { message: "owner must be a non-empty string up to 256 chars" };
  }
  return { metadata: { description, owner } };
}

/**
 * Builds a per-service usage rollup. `total` preserves all outstanding usage
 * math, while `items` includes only agents with non-zero outstanding usage.
 */
function serviceAgentUsage(serviceId: string): ServiceAgentUsage {
  const suffix = `::${serviceId}`;
  let total = 0;
  const agentTotals = new Map<string, number>();
  for (const [key, value] of usageStore.entries()) {
    if (!key.endsWith(suffix)) continue;
    total += value;
    if (value === 0) continue;
    const agent = key.slice(0, key.length - suffix.length);
    agentTotals.set(agent, (agentTotals.get(agent) ?? 0) + value);
  }
  return {
    total,
    items: Array.from(agentTotals, ([agent, agentTotal]) => ({
      agent,
      total: agentTotal,
    })),
  };
}

/**
 * Builds service registry and service rollup routes.
 */
export function createServicesRouter(): Router {
  const router = Router();

  /** Registers up to 50 services while rejecting duplicate ids in the same batch. */
  router.post(
    "/api/v1/services/bulk",
    validateBody(requestBodySchemas.bulkServices),
    (req: Request, res: Response) => {
      const { items } = req.body as BulkServicesBody;
      const serviceIdsAtBatchStart = new Set(servicesStore.keys());
      const seenServiceIds = new Set<string>();
      const results = items.map(
        (it: { serviceId?: unknown; priceStroops?: unknown }, i: number) => {
          const { serviceId, priceStroops } = it ?? {};
          if (
            typeof serviceId !== "string" ||
            serviceId.length === 0 ||
            serviceId.length > 128 ||
            typeof priceStroops !== "number" ||
            !Number.isInteger(priceStroops) ||
            priceStroops < 0
          ) {
            return { index: i, ok: false, error: "invalid_item" };
          }
          if (seenServiceIds.has(serviceId)) {
            return { index: i, ok: false, serviceId, error: "duplicate_in_batch" };
          }
          seenServiceIds.add(serviceId);
          const isNew = !serviceIdsAtBatchStart.has(serviceId);
          servicesStore.set(serviceId, { priceStroops });
          return { index: i, ok: true, serviceId, priceStroops, created: isNew };
        }
      );
      res.status(201).json({ results });
    }
    const serviceIdsAtBatchStart = new Set(servicesStore.keys());
    const seenServiceIds = new Set<string>();
    const results = items.map(
      (it: { serviceId?: unknown; priceStroops?: unknown }, i: number) => {
        const { serviceId, priceStroops } = it ?? {};
        if (
          !isValidServiceId(serviceId) ||
          typeof priceStroops !== "number" ||
          !Number.isInteger(priceStroops) ||
          priceStroops < 0
        ) {
          return { index: i, ok: false, error: "invalid_item" };
        }
        if (seenServiceIds.has(serviceId)) {
          return { index: i, ok: false, serviceId, error: "duplicate_in_batch" };
        }
        seenServiceIds.add(serviceId);
        const isNew = !serviceIdsAtBatchStart.has(serviceId);
        servicesStore.set(serviceId, { priceStroops });
        return { index: i, ok: true, serviceId, priceStroops, created: isNew };
      }
    );
    res.status(201).json({ results });
  });

  router.post("/api/v1/services", (req: Request, res: Response) => {
    const { serviceId, priceStroops } = req.body ?? {};
    const requestId = getRequestId(req);
    if (!isValidServiceId(serviceId)) {
      res.status(400).json({
        error: "invalid_request",
        message: invalidServiceIdMessage(),
        requestId,
      });
      return;
    }
  );

  router.get("/api/v1/services/:serviceId/usage", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    if (rejectInvalidServicePath(req, res, serviceId)) return;
    const suffix = `::${serviceId}`;
    let total = 0;
    let agents = 0;
    for (const entry of scanByService(serviceId)) {
      total += entry.total;
      agents++;
    }
    res.json({ serviceId, total, agents });
  });

  router.get(
    "/api/v1/services/:serviceId/agents/top",
    (req: Request, res: Response) => {
      const { serviceId } = req.params;
      if (rejectInvalidServicePath(req, res, serviceId)) return;
      const limit = Math.min(
        100,
        Math.max(1, Number((req.query.limit as string) ?? 10))
      );
      const suffix = `::${serviceId}`;
      const items: { agent: string; total: number }[] = [];
      for (const { agent, total } of scanByService(serviceId)) {
        items.push({ agent, total });
      }
      items.sort((a, b) => b.total - a.total);
      res.json({ serviceId, items: items.slice(0, limit) });
    }
  );

  router.get("/api/v1/services/:serviceId/agents", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    if (rejectInvalidServicePath(req, res, serviceId)) return;
    const suffix = `::${serviceId}`;
    const items: { agent: string; total: number }[] = [];
    for (const { agent, total } of scanByService(serviceId)) {
      items.push({ agent, total });
    }
    res.json({ serviceId, items });
  });

  /** Reads one service with its disabled state and optional metadata. */
  router.get("/api/v1/services/:serviceId", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    if (rejectInvalidServicePath(req, res, serviceId)) return;
    const meta = servicesStore.get(serviceId);
    if (!meta) {
      sendServiceNotFound(req, res, serviceId);
      return;
    }
    res.json(serviceReadShape(serviceId, storeKey, meta));
  });

  router.put("/api/v1/services/:serviceId/metadata", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const requestId = getRequestId(req);
    if (rejectInvalidServicePath(req, res, serviceId)) return;
    if (!servicesStore.has(serviceId)) {
      res.status(404).json({
        error: "not_found",
        message: `service ${serviceId} is not registered`,
        requestId,
      });
      return;
    }
  );

  router.get("/api/v1/services/:serviceId/metadata", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    if (rejectInvalidServicePath(req, res, serviceId)) return;
    const meta = servicesMetadata.get(serviceId);
    if (!meta) {
      res.status(404).json({
        error: "not_found",
        message: `no metadata for service ${serviceId}`,
        requestId: getRequestId(req),
      });
      return;
    }
    res.json({ serviceId, ...meta });
  });

  router.patch(
    "/api/v1/services/:serviceId/disabled",
    validateBody(requestBodySchemas.serviceDisabledPatch),
    (req: Request, res: Response) => {
      const { serviceId } = req.params;
      const requestId = getRequestId(req);
      if (rejectInvalidServicePath(req, res, serviceId)) return;
      if (!servicesStore.has(serviceId)) {
        res.status(404).json({
          error: "not_found",
          message: `service ${serviceId} is not registered`,
          requestId,
        });
        return;
      }
      const { priceStroops } = req.body as ServicePriceBody;
      meta.priceStroops = priceStroops;
      servicesStore.set(serviceId, meta);
      res.json({ serviceId, ...meta });
    }
  );

  router.patch("/api/v1/services/:serviceId/price", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const requestId = getRequestId(req);
    if (rejectInvalidServicePath(req, res, serviceId)) return;
    const meta = servicesStore.get(serviceId);
    if (!meta) {
      res.status(404).json({
        error: "not_found",
        message: `service ${serviceId} is not registered`,
        requestId,
      });
      return;
    }
    const { priceStroops } = req.body ?? {};
    if (
      typeof priceStroops !== "number" ||
      !Number.isInteger(priceStroops) ||
      priceStroops < 0
    ) {
      res.status(400).json({
        error: "invalid_request",
        message: "priceStroops must be a non-negative integer",
        requestId,
      });
      return;
    }
    meta.priceStroops = priceStroops;
    servicesStore.set(serviceId, meta);
    res.json({ serviceId, ...meta });
  });

  router.delete("/api/v1/services/:serviceId", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    if (rejectInvalidServicePath(req, res, serviceId)) return;
    if (!servicesStore.has(serviceId)) {
      res.status(404).json({
        error: "not_found",
        message: `service ${serviceId} is not registered`,
        requestId: getRequestId(req),
      });
      return;
    }
    servicesStore.delete(serviceId);
    servicesMetadata.delete(serviceId);
    servicesDisabled.delete(serviceId);
    recordEvent("service.deleted", { serviceId });
    res.status(204).send();
  });

  /**
   * Lists services with optional id, disabled-state, and price-range filters.
   */
  router.get("/api/v1/services", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "";
    const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
    const limit = parseIntParam(req.query.limit, {
      defaultValue: 200,
      min: 1,
      max: 1000,
    });
    const services: ServiceReadShape[] = [];
    for (const [storeKey, meta] of servicesStore.entries()) {
      const serviceId = serviceIdFromStoreKey(tenantId, storeKey);
      if (!serviceId) continue;
      if (prefix && !serviceId.startsWith(prefix)) continue;
      if (q && !serviceId.toLowerCase().includes(q)) continue;
      services.push(serviceReadShape(serviceId, storeKey, meta));
      if (services.length >= limit) break;
    }
    const body = JSON.stringify({ services });
    const etag = etagFor(body);
    if (req.header("if-none-match") === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader("ETag", etag);
    res.type("application/json").send(body);
  });

  return router;
}
