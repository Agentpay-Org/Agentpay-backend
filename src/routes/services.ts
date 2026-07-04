import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { validateBody } from "../middleware/validate.js";
import { requestBodySchemas } from "../schemas/requestBodies.js";
import {
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
} from "../store/state.js";
import { getRequestId } from "../types.js";

type ServiceReadShape = {
  serviceId: string;
  priceStroops: number;
  disabled: boolean;
  description?: string;
  owner?: string;
};

type BulkServicesBody = {
  items: { serviceId?: unknown; priceStroops?: unknown }[];
};
type ServiceCreateBody = { serviceId: string; priceStroops: number };
type ServiceMetadataBody = { description: string; owner: string };
type ServiceDisabledBody = { disabled: boolean };
type ServicePriceBody = { priceStroops: number };

/**
 * Builds the public read shape for service detail and list endpoints.
 */
function serviceReadShape(
  serviceId: string,
  meta: { priceStroops: number }
): ServiceReadShape {
  const metadata = servicesMetadata.get(serviceId);
  return {
    serviceId,
    priceStroops: meta.priceStroops,
    disabled: servicesDisabled.has(serviceId),
    ...(metadata ?? {}),
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
  );

  router.post(
    "/api/v1/services",
    validateBody(requestBodySchemas.serviceCreate),
    (req: Request, res: Response) => {
      const { serviceId, priceStroops } = req.body as ServiceCreateBody;
      const isNew = !servicesStore.has(serviceId);
      servicesStore.set(serviceId, { priceStroops });
      res.status(isNew ? 201 : 200).json({ serviceId, priceStroops });
    }
  );

  router.get("/api/v1/services/:serviceId/usage", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const suffix = `::${serviceId}`;
    let total = 0;
    let agents = 0;
    for (const [key, value] of usageStore.entries()) {
      if (key.endsWith(suffix)) {
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
      const limit = Math.min(
        100,
        Math.max(1, Number((req.query.limit as string) ?? 10))
      );
      const suffix = `::${serviceId}`;
      const items: { agent: string; total: number }[] = [];
      for (const [key, total] of usageStore.entries()) {
        if (key.endsWith(suffix)) {
          items.push({ agent: key.slice(0, key.length - suffix.length), total });
        }
      }
      items.sort((a, b) => b.total - a.total);
      res.json({ serviceId, items: items.slice(0, limit) });
    }
  );

  router.get("/api/v1/services/:serviceId/agents", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const suffix = `::${serviceId}`;
    const items: { agent: string; total: number }[] = [];
    for (const [key, total] of usageStore.entries()) {
      if (key.endsWith(suffix)) {
        items.push({ agent: key.slice(0, key.length - suffix.length), total });
      }
    }
    res.json({ serviceId, items });
  });

  /** Reads one service with its disabled state and optional metadata. */
  router.get("/api/v1/services/:serviceId", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    const meta = servicesStore.get(serviceId);
    if (!meta) {
      res.status(404).json({
        error: "not_found",
        message: `service ${serviceId} is not registered`,
        requestId: getRequestId(req),
      });
      return;
    }
    res.json(serviceReadShape(serviceId, meta));
  });

  router.put(
    "/api/v1/services/:serviceId/metadata",
    validateBody(requestBodySchemas.serviceMetadataPut),
    (req: Request, res: Response) => {
      const { serviceId } = req.params;
      const requestId = getRequestId(req);
      if (!servicesStore.has(serviceId)) {
        res.status(404).json({
          error: "not_found",
          message: `service ${serviceId} is not registered`,
          requestId,
        });
        return;
      }
      const { description, owner } = req.body as ServiceMetadataBody;
      servicesMetadata.set(serviceId, { description, owner });
      res.json({ serviceId, description, owner });
    }
  );

  router.get("/api/v1/services/:serviceId/metadata", (req: Request, res: Response) => {
    const { serviceId } = req.params;
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
      if (!servicesStore.has(serviceId)) {
        res.status(404).json({
          error: "not_found",
          message: `service ${serviceId} is not registered`,
          requestId,
        });
        return;
      }
      const { disabled } = req.body as ServiceDisabledBody;
      if (disabled) servicesDisabled.add(serviceId);
      else servicesDisabled.delete(serviceId);
      res.json({ serviceId, disabled });
    }
  );

  router.patch(
    "/api/v1/services/:serviceId/price",
    validateBody(requestBodySchemas.servicePricePatch),
    (req: Request, res: Response) => {
      const { serviceId } = req.params;
      const requestId = getRequestId(req);
      const meta = servicesStore.get(serviceId);
      if (!meta) {
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

  router.delete("/api/v1/services/:serviceId", (req: Request, res: Response) => {
    const { serviceId } = req.params;
    if (!servicesStore.has(serviceId)) {
      res.status(404).json({
        error: "not_found",
        message: `service ${serviceId} is not registered`,
        requestId: getRequestId(req),
      });
      return;
    }
    servicesStore.delete(serviceId);
    res.status(204).send();
  });

  /** Lists services with their disabled state and optional metadata. */
  router.get("/api/v1/services", (req: Request, res: Response) => {
    const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "";
    const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
    const limit = Math.min(
      1000,
      Math.max(1, Number((req.query.limit as string) ?? 200))
    );
    const services: ServiceReadShape[] = [];
    for (const [serviceId, meta] of servicesStore.entries()) {
      if (prefix && !serviceId.startsWith(prefix)) continue;
      if (q && !serviceId.toLowerCase().includes(q)) continue;
      services.push(serviceReadShape(serviceId, meta));
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
