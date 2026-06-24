import { Router, type Request, type Response } from "express";
import { recordEvent } from "../events.js";
import { parseIntParam } from "../queryParams.js";
import {
  servicesDisabled,
  servicesStore,
  usageKey,
  usageStore,
} from "../store/state.js";
import { getRequestId } from "../types.js";

type BulkUsageResult = {
  index: number;
  ok: boolean;
  total?: number;
  error?: string;
};

/**
 * Builds usage, billing, settlement, and agent rollup routes.
 */
export function createUsageRouter(): Router {
  const router = Router();

  router.post("/api/v1/usage", (req: Request, res: Response) => {
    const { agent, serviceId, requests } = req.body ?? {};
    const requestId = getRequestId(req);

    if (typeof agent !== "string" || agent.length === 0 || agent.length > 256) {
      res.status(400).json({
        error: "invalid_request",
        message: "agent must be a non-empty string up to 256 chars",
        requestId,
      });
      return;
    }
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
    if (typeof requests !== "number" || !Number.isInteger(requests) || requests <= 0) {
      res.status(400).json({
        error: "invalid_request",
        message: "requests must be a positive integer",
        requestId,
      });
      return;
    }

    if (servicesDisabled.has(serviceId)) {
      res.status(409).json({
        error: "service_disabled",
        message: `service ${serviceId} is currently disabled`,
        requestId,
      });
      return;
    }

    const key = usageKey(agent, serviceId);
    const prev = usageStore.get(key) ?? 0;
    const total = Math.min(Number.MAX_SAFE_INTEGER, prev + requests);
    usageStore.set(key, total);

    recordEvent("usage.recorded", { agent, serviceId, requests, total });
    res.status(201).json({ agent, serviceId, total });
  });

  router.post("/api/v1/usage/bulk", (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const { items } = req.body ?? {};
    if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
      res.status(400).json({
        error: "invalid_request",
        message: "items must be a non-empty array of up to 100 entries",
        requestId,
      });
      return;
    }
    const results: BulkUsageResult[] = [];
    for (let i = 0; i < items.length; i++) {
      const { agent, serviceId, requests } = items[i] ?? {};
      if (
        typeof agent !== "string" ||
        typeof serviceId !== "string" ||
        typeof requests !== "number" ||
        !Number.isInteger(requests) ||
        requests <= 0
      ) {
        results.push({ index: i, ok: false, error: "invalid_item" });
        continue;
      }
      const key = usageKey(agent, serviceId);
      const total = Math.min(
        Number.MAX_SAFE_INTEGER,
        (usageStore.get(key) ?? 0) + requests
      );
      usageStore.set(key, total);
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
  });

  router.get("/api/v1/usage/:agent/:serviceId", (req: Request, res: Response) => {
    const { agent, serviceId } = req.params;
    const total = usageStore.get(usageKey(agent, serviceId)) ?? 0;
    res.json({ agent, serviceId, total });
  });

  router.get("/api/v1/usage/export.csv", (_req, res: Response) => {
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows: string[] = ["agent,serviceId,total"];
    for (const [key, total] of usageStore.entries()) {
      const [agent, serviceId] = key.split("::");
      rows.push(`${escape(agent)},${escape(serviceId)},${total}`);
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=usage.csv");
    res.send(rows.join("\n") + "\n");
  });

  router.get("/api/v1/usage/export.json", (_req, res: Response) => {
    const items: { agent: string; serviceId: string; total: number }[] = [];
    for (const [key, total] of usageStore.entries()) {
      const [agent, serviceId] = key.split("::");
      items.push({ agent, serviceId, total });
    }
    res.setHeader("Content-Disposition", "attachment; filename=usage.json");
    res.json({ exportedAt: Date.now(), items });
  });

  router.get("/api/v1/billing/total", (_req, res: Response) => {
    let totalStroops = 0;
    for (const [key, requests] of usageStore.entries()) {
      const [, serviceId] = key.split("::");
      const price = servicesStore.get(serviceId)?.priceStroops ?? 0;
      totalStroops += requests * price;
    }
    res.json({ totalStroops });
  });

  router.get("/api/v1/billing/:agent/:serviceId", (req: Request, res: Response) => {
    const { agent, serviceId } = req.params;
    const requests = usageStore.get(usageKey(agent, serviceId)) ?? 0;
    const price = servicesStore.get(serviceId)?.priceStroops ?? 0;
    res.json({
      agent,
      serviceId,
      requests,
      priceStroops: price,
      billedStroops: requests * price,
    });
  });

  router.post("/api/v1/settle", (req: Request, res: Response) => {
    const { agent, serviceId } = req.body ?? {};
    const requestId = getRequestId(req);
    if (typeof agent !== "string" || typeof serviceId !== "string") {
      res.status(400).json({
        error: "invalid_request",
        message: "agent and serviceId are required strings",
        requestId,
      });
      return;
    }
    const key = usageKey(agent, serviceId);
    const requests = usageStore.get(key) ?? 0;
    const price = servicesStore.get(serviceId)?.priceStroops ?? 0;
    const billedStroops = requests * price;
    usageStore.set(key, 0);
    recordEvent("usage.settled", { agent, serviceId, requests, billedStroops });
    res.json({ agent, serviceId, requests, priceStroops: price, billedStroops });
  });

  router.get("/api/v1/agents", (req: Request, res: Response) => {
    const limit = parseIntParam(req.query.limit, {
      default: 200,
      min: 1,
      max: 1000,
    });
    const seen = new Set<string>();
    for (const key of usageStore.keys()) seen.add(key.split("::")[0]);
    const agents = Array.from(seen).slice(0, limit);
    res.json({ agents });
  });

  router.get("/api/v1/agents/:agent/total", (req: Request, res: Response) => {
    const { agent } = req.params;
    const prefix = `${agent}::`;
    let total = 0;
    for (const [key, n] of usageStore.entries()) {
      if (key.startsWith(prefix)) total += n;
    }
    res.json({ agent, total });
  });

  router.get("/api/v1/agents/:agent/usage", (req: Request, res: Response) => {
    const { agent } = req.params;
    const prefix = `${agent}::`;
    const items: { serviceId: string; total: number }[] = [];
    for (const [key, total] of usageStore.entries()) {
      if (key.startsWith(prefix)) {
        items.push({ serviceId: key.slice(prefix.length), total });
      }
    }
    res.json({ agent, items });
  });

  return router;
}
