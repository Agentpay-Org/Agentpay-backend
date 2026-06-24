import { createHash } from "node:crypto";
import { Router, type Request, type Response } from "express";
import {
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
} from "../store/state.js";
import { parseIntParam } from "../queryParams.js";
import { getRequestId } from "../types.js";

/**
 * Builds service registry and service rollup routes.
 */
export function createServicesRouter(): Router {
  const router = Router();

  router.post("/api/v1/services/bulk", (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const { items } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      res.status(400).json({
        error: "invalid_request",
        message: "items must be 1-50 entries",
        requestId,
      });
      return;
    }
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
        const isNew = !servicesStore.has(serviceId);
        servicesStore.set(serviceId, { priceStroops });
        return { index: i, ok: true, serviceId, priceStroops, created: isNew };
      }
    );
    res.status(201).json({ results });
  });

  router.post("/api/v1/services", (req: Request, res: Response) => {
    const { serviceId, priceStroops } = req.body ?? {};
    const requestId = getRequestId(req);
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
    const isNew = !servicesStore.has(serviceId);
    servicesStore.set(serviceId, { priceStroops });
    res.status(isNew ? 201 : 200).json({ serviceId, priceStroops });
  });

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
      const limit = parseIntParam(req.query.limit, {
        default: 10,
        min: 1,
        max: 100,
      });
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
    res.json({ serviceId, ...meta });
  });

  router.put("/api/v1/services/:serviceId/metadata", (req: Request, res: Response) => {
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
    servicesMetadata.set(serviceId, { description, owner });
    res.json({ serviceId, description, owner });
  });

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
      const { disabled } = req.body ?? {};
      if (typeof disabled !== "boolean") {
        res.status(400).json({
          error: "invalid_request",
          message: "disabled must be a boolean",
          requestId,
        });
        return;
      }
      if (disabled) servicesDisabled.add(serviceId);
      else servicesDisabled.delete(serviceId);
      res.json({ serviceId, disabled });
    }
  );

  router.patch("/api/v1/services/:serviceId/price", (req: Request, res: Response) => {
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

  router.get("/api/v1/services", (req: Request, res: Response) => {
    const prefix = typeof req.query.prefix === "string" ? req.query.prefix : "";
    const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
    const limit = parseIntParam(req.query.limit, {
      default: 200,
      min: 1,
      max: 1000,
    });
    const services: { serviceId: string; priceStroops: number }[] = [];
    for (const [serviceId, meta] of servicesStore.entries()) {
      if (prefix && !serviceId.startsWith(prefix)) continue;
      if (q && !serviceId.toLowerCase().includes(q)) continue;
      services.push({ serviceId, ...meta });
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
