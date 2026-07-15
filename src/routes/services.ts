import { Router, type Request, type Response } from "express";
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

type ServiceAgentUsage = {
  total: number;
  items: { agent: string; total: number }[];
};

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

  /** Registers up to the runtime bulk limit while rejecting duplicate ids. */
  router.post("/api/v1/services/bulk", (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    const { items } = req.body ?? {};
    const limit = config.bulkMaxItems;
    if (!Array.isArray(items) || items.length === 0 || items.length > limit) {
      res.status(400).json({
        error: "invalid_request",
        message: `items must be a non-empty array of up to ${limit} entries`,
        requestId,
      });
      return;
    }
    const serviceIdsAtBatchStart = new Set(
      Array.from(servicesStore.keys())
        .map((storeKey) => serviceIdFromStoreKey(tenantId, storeKey))
        .filter((serviceId): serviceId is string => typeof serviceId === "string")
    );
    const seenServiceIds = new Set<string>();
    const results = items.map(
      (it: { serviceId?: unknown; priceStroops?: unknown }, i: number) => {
        const { serviceId, priceStroops } = it ?? {};
        if (
          typeof serviceId !== "string" ||
          serviceId.length === 0 ||
          serviceId.length > 128 ||
          !isSafePrice(priceStroops)
        ) {
          return { index: i, ok: false, error: "invalid_item" };
        }
        if (seenServiceIds.has(serviceId)) {
          return { index: i, ok: false, serviceId, error: "duplicate_in_batch" };
        }
        seenServiceIds.add(serviceId);
        const isNew = !serviceIdsAtBatchStart.has(serviceId);
        if (
          isNew &&
          !hasCapacityForNewKey(servicesStore, serviceId, "servicesStoreMaxKeys")
        ) {
          return {
            index: i,
            ok: false,
            serviceId,
            error: "store_capacity_exceeded",
          };
        }
        servicesStore.set(serviceId, { priceStroops });
        return { index: i, ok: true, serviceId, priceStroops, created: isNew };
      }
    );
    res.status(201).json({ results });
  });

  router.post("/api/v1/services", (req: Request, res: Response) => {
    const { serviceId, priceStroops, description, owner } = req.body ?? {};
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    if (
      typeof serviceId !== "string" ||
      serviceId.length === 0 ||
      serviceId.length > 128
    ) {
      res.status(400).json({
        error: "invalid_request",
        message: "serviceId must be a non-empty string up to 128 chars",
        requestId,
      });
      return;
    }
    if (!isSafePrice(priceStroops)) {
      res.status(400).json({
        error: "invalid_request",
        message: `priceStroops must be a non-negative integer up to ${MAX_PRICE_STROOPS}`,
        requestId,
      });
      return;
    }

    let inlineMetadata: ServiceMetadataDto | undefined;
    if (description !== undefined || owner !== undefined) {
      const metadataResult = validateServiceMetadata(description, owner);
      if ("message" in metadataResult) {
        res.status(400).json({
          error: "invalid_request",
          message: metadataResult.message,
          requestId,
        });
        return;
      }
      inlineMetadata = metadataResult.metadata;
    }

    const isNew = !servicesStore.has(serviceId);
    if (
      isNew &&
      !hasCapacityForNewKey(servicesStore, serviceId, "servicesStoreMaxKeys")
    ) {
      res
        .status(429)
        .json(storeCapacityError("servicesStore", "servicesStoreMaxKeys", requestId));
      return;
    }
    servicesStore.set(serviceId, { priceStroops });
    if (inlineMetadata) {
      servicesMetadata.set(serviceId, inlineMetadata);
    }
    res
      .status(isNew ? 201 : 200)
      .json({ serviceId, priceStroops, ...(inlineMetadata ?? {}) });
  });

  router.get("/api/v1/services/:serviceId/usage", (req: Request, res: Response) => {
    const { serviceId } = req.params;
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
      const tenantId = resolveTenantId(req);
      if (!servicesStore.has(tenantServiceKey(tenantId, serviceId))) {
        sendServiceNotFound(req, res, serviceId);
        return;
      }
      const limit = Math.min(
        100,
        Math.max(1, Number((req.query.limit as string) ?? 10))
      );
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
    const items: { agent: string; total: number }[] = [];
    for (const { agent, total } of scanByService(serviceId)) {
      items.push({ agent, total });
    }
    res.json({ serviceId, items });
  });

  /** Reads one service with its disabled state and optional metadata. */
  router.get("/api/v1/services/:serviceId", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const tenantId = resolveTenantId(req);
    const storeKey = tenantServiceKey(tenantId, serviceId);
    const meta = servicesStore.get(storeKey);
    if (!meta) {
      sendServiceNotFound(req, res, serviceId);
      return;
    }
    res.json(serviceReadShape(serviceId, storeKey, meta));
  });

  router.put("/api/v1/services/:serviceId/metadata", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    const storeKey = tenantServiceKey(tenantId, serviceId);
    if (!servicesStore.has(storeKey)) {
      sendServiceNotFound(req, res, serviceId);
      return;
    }
    const { description, owner } = req.body ?? {};
    const metadataResult = validateServiceMetadata(description, owner);
    if ("message" in metadataResult) {
      res.status(400).json({
        error: "invalid_request",
        message: metadataResult.message,
        requestId,
      });
      return;
    }
    servicesMetadata.set(serviceId, metadataResult.metadata);
    res.json({ serviceId, ...metadataResult.metadata });
  });

  router.get("/api/v1/services/:serviceId/metadata", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const tenantId = resolveTenantId(req);
    const storeKey = tenantServiceKey(tenantId, serviceId);
    if (!servicesStore.has(storeKey)) {
      sendServiceNotFound(req, res, serviceId);
      return;
    }
    const meta = servicesMetadata.get(storeKey);
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
    (req: Request, res: Response) => {
      const { serviceId } = req.params;
      const requestId = getRequestId(req);
      const tenantId = resolveTenantId(req);
      const storeKey = tenantServiceKey(tenantId, serviceId);
      if (!servicesStore.has(storeKey)) {
        sendServiceNotFound(req, res, serviceId);
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
      if (disabled) servicesDisabled.add(storeKey);
      else servicesDisabled.delete(storeKey);
      res.json({ serviceId, disabled });
    }
  );

  router.patch("/api/v1/services/:serviceId/price", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    const storeKey = tenantServiceKey(tenantId, serviceId);
    const meta = servicesStore.get(storeKey);
    if (!meta) {
      sendServiceNotFound(req, res, serviceId);
      return;
    }
    const { priceStroops } = req.body ?? {};
    if (!isSafePrice(priceStroops)) {
      res.status(400).json({
        error: "invalid_request",
        message: `priceStroops must be a non-negative integer up to ${MAX_PRICE_STROOPS}`,
        requestId,
      });
      return;
    }
    meta.priceStroops = priceStroops;
    servicesStore.set(storeKey, meta);
    res.json({ serviceId, ...meta });
  });

  router.delete("/api/v1/services/:serviceId", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const tenantId = resolveTenantId(req);
    const storeKey = tenantServiceKey(tenantId, serviceId);
    if (!servicesStore.has(storeKey)) {
      sendServiceNotFound(req, res, serviceId);
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
    const disabled = parseDisabledFilter(req.query.disabled);
    const minPrice = parsePriceFilter(req.query.minPrice);
    const maxPrice = parsePriceFilter(req.query.maxPrice);
    const limit = Math.min(
      1000,
      Math.max(1, Number((req.query.limit as string) ?? 200))
    );
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
