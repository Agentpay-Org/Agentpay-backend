import { Router, type Request, type Response } from "express";
import { recordEvent } from "../events.js";
import { isValidServiceId } from "../identifiers.js";
import { validateBody } from "../middleware/validate.js";
import { parseIntParam } from "../queryParams.js";
import { requestBodySchemas } from "../schemas/requestBodies.js";
import {
  config,
  parseServiceKey,
  parseUsageKey,
  serviceKey,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  type ServiceMetadataDto,
  usageStore,
} from "../store/state.js";
import { resolveTenantId } from "../tenant.js";
import { getRequestId } from "../types.js";
import { etagFor } from "../httpCache.js";

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

function _rejectInvalidServicePath(
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

function sendServiceNotFound(req: Request, res: Response, serviceId: string): void {
  res.status(404).json({
    error: "not_found",
    message: `service ${serviceId} is not registered`,
    requestId: getRequestId(req),
  });
}

/**
 * Builds the public read shape for service detail and list endpoints.
 */
function serviceReadShape(
  tenantId: string,
  serviceId: string,
  meta: { priceStroops: number }
): ServiceReadShape {
  const key = serviceKey(tenantId, serviceId);
  const metadata = servicesMetadata.get(key);
  return {
    serviceId,
    priceStroops: meta.priceStroops,
    disabled: servicesDisabled.has(key),
    ...(metadata ?? {}),
  };
}

/** Validates service metadata for both inline registration and metadata updates. */
function _validateServiceMetadata(
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

type ServiceAgentUsage = {
  total: number;
  items: { agent: string; total: number }[];
};

/**
 * Builds a per-service usage rollup. `total` preserves all outstanding usage
 * math, while `items` includes only agents with non-zero outstanding usage.
 */
function _serviceAgentUsage(serviceId: string): ServiceAgentUsage {
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

  /**
   * Registers up to config.bulkMaxItems services in a single batch while
   * rejecting duplicate ids within the same request.  The active limit is
   * controlled by PATCH /api/v1/config (default 100, max 1000).
   */
  router.post("/api/v1/services/bulk", (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    const { items } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0 || items.length > config.bulkMaxItems) {
      res.status(400).json({
        error: "invalid_request",
        message: `items must be 1-${config.bulkMaxItems} entries`,
        requestId,
      });
      return;
    }
    const serviceIdsAtBatchStart = new Set<string>();
    for (const key of servicesStore.keys()) {
      const parsed = parseServiceKey(key);
      if (parsed.tenantId === tenantId) {
        serviceIdsAtBatchStart.add(parsed.serviceId);
      }
    }
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
        servicesStore.set(serviceKey(tenantId, serviceId), { priceStroops });
        return { index: i, ok: true, serviceId, priceStroops, created: isNew };
      }
    );
    res.status(201).json({ results });
  });

  router.post("/api/v1/services", (req: Request, res: Response) => {
    const { serviceId, priceStroops } = req.body ?? {};
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    if (
      typeof serviceId !== "string" ||
      serviceId.length === 0 ||
      serviceId.length > 128
    ) {
      res.status(400).json({
        error: "invalid_request",
        message: invalidServiceIdMessage(),
        requestId,
      });
      return;
    }
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
    const key = serviceKey(tenantId, serviceId);
    const isNew = !servicesStore.has(key);
    servicesStore.set(key, { priceStroops });
    res.status(isNew ? 201 : 200).json({ serviceId, priceStroops });
  });

  router.get("/api/v1/services/:serviceId/usage", (req: Request, res: Response) => {
    const serviceId = String(req.params.serviceId);
    const tenantId = resolveTenantId(req);
    let total = 0;
    let agents = 0;
    for (const [key, value] of usageStore.entries()) {
      const parsed = parseUsageKey(key);
      if (parsed.tenantId === tenantId && parsed.serviceId === serviceId) {
        total += value;
        agents++;
      }
    }
    res.json({ serviceId, total, agents });
  });

  router.get(
    "/api/v1/services/:serviceId/agents/top",
    (req: Request, res: Response) => {
      const serviceId = String(req.params.serviceId);
      const tenantId = resolveTenantId(req);
      const limit = Math.min(
        100,
        Math.max(1, Number((req.query.limit as string) ?? 10))
      );
      const items: { agent: string; total: number }[] = [];
      for (const [key, total] of usageStore.entries()) {
        const parsed = parseUsageKey(key);
        if (parsed.tenantId === tenantId && parsed.serviceId === serviceId) {
          items.push({ agent: parsed.agent, total });
        }
      }
      items.sort((a, b) => b.total - a.total);
      res.json({ serviceId, items: items.slice(0, limit) });
    }
  );

  router.get("/api/v1/services/:serviceId/agents", (req: Request, res: Response) => {
    const serviceId = String(req.params.serviceId);
    const tenantId = resolveTenantId(req);
    const items: { agent: string; total: number }[] = [];
    for (const [key, total] of usageStore.entries()) {
      const parsed = parseUsageKey(key);
      if (parsed.tenantId === tenantId && parsed.serviceId === serviceId) {
        items.push({ agent: parsed.agent, total });
      }
    }
    res.json({ serviceId, items });
  });

  /** Reads one service with its disabled state and optional metadata. */
  router.get("/api/v1/services/:serviceId", (req: Request, res: Response) => {
    const serviceId = String(req.params.serviceId);
    const tenantId = resolveTenantId(req);
    const meta = servicesStore.get(serviceKey(tenantId, serviceId));
    if (!meta) {
      sendServiceNotFound(req, res, serviceId);
      return;
    }
    res.json(serviceReadShape(tenantId, serviceId, meta));
  });

  router.put("/api/v1/services/:serviceId/metadata", (req: Request, res: Response) => {
    const serviceId = String(req.params.serviceId);
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    const key = serviceKey(tenantId, serviceId);
    if (!servicesStore.has(key)) {
      res.status(404).json({
        error: "not_found",
        message: `service ${serviceId} is not registered`,
        requestId,
      });
      return;
    }
    const { description, owner } = req.body ?? {};
    if (typeof description !== "string" || description.length > 256) {
      res.status(400).json({
        error: "invalid_request",
        message: "description must be a string up to 256 chars",
        requestId,
      });
      return;
    }
    if (typeof owner !== "string" || owner.length === 0 || owner.length > 256) {
      res.status(400).json({
        error: "invalid_request",
        message: "owner must be a non-empty string up to 256 chars",
        requestId,
      });
      return;
    }
    servicesMetadata.set(key, { description, owner });
    res.json({ serviceId, description, owner });
  });

  router.get("/api/v1/services/:serviceId/metadata", (req: Request, res: Response) => {
    const serviceId = String(req.params.serviceId);
    const tenantId = resolveTenantId(req);
    const meta = servicesMetadata.get(serviceKey(tenantId, serviceId));
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

  /** Idempotently disables a registered service and emits an audit event. */
  router.post("/api/v1/services/:serviceId/disable", (req: Request, res: Response) => {
    const serviceId = String(req.params.serviceId);
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    const key = serviceKey(tenantId, serviceId);
    if (!servicesStore.has(key)) {
      res.status(404).json({
        error: "not_found",
        message: `service ${serviceId} is not registered`,
        requestId,
      });
      return;
    }
    servicesDisabled.add(key);
    recordEvent("service.disabled", { serviceId, tenantId });
    res.json({ serviceId, disabled: true });
  });

  /** Idempotently enables a registered service and emits an audit event. */
  router.post("/api/v1/services/:serviceId/enable", (req: Request, res: Response) => {
    const serviceId = String(req.params.serviceId);
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    const key = serviceKey(tenantId, serviceId);
    if (!servicesStore.has(key)) {
      res.status(404).json({
        error: "not_found",
        message: `service ${serviceId} is not registered`,
        requestId,
      });
      return;
    }
    servicesDisabled.delete(key);
    recordEvent("service.enabled", { serviceId, tenantId });
    res.json({ serviceId, disabled: false });
  });

  router.patch(
    "/api/v1/services/:serviceId/disabled",
    validateBody(requestBodySchemas.serviceDisabledPatch),
    (req: Request, res: Response) => {
      const serviceId = String(req.params.serviceId);
      const requestId = getRequestId(req);
      const tenantId = resolveTenantId(req);
      const key = serviceKey(tenantId, serviceId);
      if (!servicesStore.has(key)) {
        res.status(404).json({
          error: "not_found",
          message: `service ${serviceId} is not registered`,
          requestId,
        });
        return;
      }
      const { disabled } = req.body ?? {};
      if (typeof disabled !== "boolean") {
        res.status(400).json({
          error: "invalid_request",
          message: "disabled must be a boolean",
          requestId,
        });
        return;
      }
      if (disabled) servicesDisabled.add(key);
      else servicesDisabled.delete(key);
      res.json({ serviceId, disabled });
    }
  );

  router.patch("/api/v1/services/:serviceId/price", (req: Request, res: Response) => {
    const serviceId = String(req.params.serviceId);
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    const key = serviceKey(tenantId, serviceId);
    const meta = servicesStore.get(key);
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
    servicesStore.set(key, meta);
    res.json({ serviceId, ...meta });
  });

  router.delete("/api/v1/services/:serviceId", (req: Request, res: Response) => {
    const serviceId = String(req.params.serviceId);
    const tenantId = resolveTenantId(req);
    const key = serviceKey(tenantId, serviceId);
    if (!servicesStore.has(key)) {
      res.status(404).json({
        error: "not_found",
        message: `service ${serviceId} is not registered`,
        requestId: getRequestId(req),
      });
      return;
    }
    servicesStore.delete(key);
    servicesDisabled.delete(key);
    servicesMetadata.delete(key);
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
    for (const [key, meta] of servicesStore.entries()) {
      const parsed = parseServiceKey(key);
      if (parsed.tenantId !== tenantId) continue;
      const { serviceId } = parsed;
      if (prefix && !serviceId.startsWith(prefix)) continue;
      if (q && !serviceId.toLowerCase().includes(q)) continue;
      services.push(serviceReadShape(tenantId, serviceId, meta));
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
