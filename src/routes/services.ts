import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import {
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
} from "../store/state.js";
import {
  resolveTenantId,
  serviceIdFromStoreKey,
  tenantServiceKey,
  usagePartsFromStoreKey,
} from "../tenant.js";
import { getRequestId } from "../types.js";
import { isSafePrice, MAX_PRICE_STROOPS } from "../validation.js";

type ServiceReadShape = {
  serviceId: string;
  priceStroops: number;
  disabled: boolean;
  description?: string;
  owner?: string;
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

function sendServiceNotFound(req: Request, res: Response, serviceId: string): void {
  res.status(404).json({
    error: "not_found",
    message: `service ${serviceId} is not registered`,
    requestId: getRequestId(req),
  });
}

/**
 * Parses optional non-negative integer price filters; malformed values are ignored.
 */
function parsePriceFilter(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return undefined;
  return parsed;
}

/**
 * Parses the disabled-state filter only when clients pass literal true/false.
 */
function parseDisabledFilter(value: unknown): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

/**
 * Builds service registry and service rollup routes.
 */
export function createServicesRouter(): Router {
  const router = Router();

  /** Registers up to 50 services while rejecting duplicate ids in the same batch. */
  router.post("/api/v1/services/bulk", (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    const { items } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      res.status(400).json({
        error: "invalid_request",
        message: "items must be 1-50 entries",
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
        servicesStore.set(tenantServiceKey(tenantId, serviceId), { priceStroops });
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
        message: "serviceId must be a non-empty string up to 128 chars",
        requestId,
      });
      return;
    }
    if (
      !isSafePrice(priceStroops)
    ) {
      res.status(400).json({
        error: "invalid_request",
        message: `priceStroops must be a non-negative integer up to ${MAX_PRICE_STROOPS}`,
        requestId,
      });
      return;
    }
    const storeKey = tenantServiceKey(tenantId, serviceId);
    const isNew = !servicesStore.has(storeKey);
    servicesStore.set(storeKey, { priceStroops });
    res.status(isNew ? 201 : 200).json({ serviceId, priceStroops });
  });

  router.get("/api/v1/services/:serviceId/usage", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const tenantId = resolveTenantId(req);
    if (!servicesStore.has(tenantServiceKey(tenantId, serviceId))) {
      sendServiceNotFound(req, res, serviceId);
      return;
    }
    let total = 0;
    let agents = 0;
    for (const [key, value] of usageStore.entries()) {
      const parts = usagePartsFromStoreKey(tenantId, key);
      if (parts?.serviceId === serviceId) {
        total += value;
        agents++;
      }
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
      for (const [key, total] of usageStore.entries()) {
        const parts = usagePartsFromStoreKey(tenantId, key);
        if (parts?.serviceId === serviceId) {
          items.push({ agent: parts.agent, total });
        }
      }
      items.sort((a, b) => b.total - a.total);
      res.json({ serviceId, items: items.slice(0, limit) });
    }
  );

  router.get("/api/v1/services/:serviceId/agents", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const tenantId = resolveTenantId(req);
    if (!servicesStore.has(tenantServiceKey(tenantId, serviceId))) {
      sendServiceNotFound(req, res, serviceId);
      return;
    }
    const items: { agent: string; total: number }[] = [];
    for (const [key, total] of usageStore.entries()) {
      const parts = usagePartsFromStoreKey(tenantId, key);
      if (parts?.serviceId === serviceId) {
        items.push({ agent: parts.agent, total });
      }
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
    servicesMetadata.set(storeKey, { description, owner });
    res.json({ serviceId, description, owner });
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
    if (
      !isSafePrice(priceStroops)
    ) {
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
    servicesStore.delete(storeKey);
    servicesDisabled.delete(storeKey);
    servicesMetadata.delete(storeKey);
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
    const etag = `W/"${createHash("sha1").update(body).digest("base64").slice(0, 16)}"`;
    if (req.header("if-none-match") === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader("ETag", etag);
    res.type("application/json").send(body);
  });

  return router;
}
