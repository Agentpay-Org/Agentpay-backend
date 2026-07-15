import { Router, type Request, type Response } from "express";
import { recordEvent } from "../events.js";
import {
  settlementCounters,
  servicesDisabled,
  servicesStore,
  usageKey,
  usageStore,
} from "../store/state.js";
import {
  resolveTenantId,
  tenantServiceKey,
  usagePartsFromStoreKey,
} from "../tenant.js";
import { getRequestId } from "../types.js";
import { isSafeCount, MAX_REQUESTS_PER_CALL } from "../validation.js";

type BulkUsageResult = {
  index: number;
  ok: boolean;
  total?: number;
  error?: string;
};

type BillingTotalBreakdown = {
  totalStroops: number;
  disabledStroops: number;
  unpricedRequests: number;
};

function sendServiceNotFound(req: Request, res: Response, serviceId: string): void {
  res.status(404).json({
    error: "not_found",
    message: `service ${serviceId} is not registered`,
    requestId: getRequestId(req),
  });
}

/**
 * Builds usage, billing, settlement, and agent rollup routes.
 */
export function createUsageRouter(): Router {
  const router = Router();

  router.post("/api/v1/usage", (req: Request, res: Response) => {
    const { agent, serviceId, requests } = req.body ?? {};
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);

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
    if (!isSafeCount(requests)) {
      res.status(400).json({
        error: "invalid_request",
        message: `requests must be a positive integer up to ${MAX_REQUESTS_PER_CALL}`,
        requestId,
      });
      return;
    }

    if (servicesDisabled.has(tenantServiceKey(tenantId, serviceId))) {
      res.status(409).json({
        error: "service_disabled",
        message: `service ${serviceId} is currently disabled`,
        requestId,
      });
      return;
    }

    const key = usageKey(agent, serviceId, tenantId);
    const prev = usageStore.get(key) ?? 0;
    const total = Math.min(Number.MAX_SAFE_INTEGER, prev + requests);
    usageStore.set(key, total);
    incrementLifetimeRequests(requests);

    recordEvent("usage.recorded", { agent, serviceId, requests, total });
    res.status(201).json({ agent, serviceId, total });
  });

  router.post("/api/v1/usage/bulk", (req: Request, res: Response) => {
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
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
        !isSafeCount(requests)
      ) {
        results.push({ index: i, ok: false, error: "invalid_item" });
        continue;
      }
      const key = usageKey(agent, serviceId, tenantId);
      const total = Math.min(
        Number.MAX_SAFE_INTEGER,
        (usageStore.get(key) ?? 0) + requests
      );
      usageStore.set(key, total);
      incrementLifetimeRequests(requests);
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
    const tenantId = resolveTenantId(req);
    const total = usageStore.get(usageKey(agent, serviceId, tenantId)) ?? 0;
    res.json({ agent, serviceId, total });
  });

  router.get("/api/v1/usage/export.csv", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows: string[] = ["agent,serviceId,total"];
    for (const [key, total] of usageStore.entries()) {
      const parts = usagePartsFromStoreKey(tenantId, key);
      if (!parts) continue;
      rows.push(`${escape(parts.agent)},${escape(parts.serviceId)},${total}`);
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=usage.csv");
    res.send(rows.join("\n") + "\n");
  });

  router.get("/api/v1/usage/export.json", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    const items: { agent: string; serviceId: string; total: number }[] = [];
    for (const [key, total] of usageStore.entries()) {
      const parts = usagePartsFromStoreKey(tenantId, key);
      if (!parts) continue;
      items.push({ agent: parts.agent, serviceId: parts.serviceId, total });
    }
    res.setHeader("Content-Disposition", "attachment; filename=usage.json");
    res.json({ exportedAt: Date.now(), items });
  });

  /**
   * Returns one aggregate billing snapshot without exposing per-agent usage.
   * totalStroops keeps the historic meaning: all priced usage, including
   * disabled services. The added fields expose hidden disabled and unpriced
   * buckets without silently folding them into zero-priced usage.
   */
  router.get("/api/v1/billing/total", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    const breakdown: BillingTotalBreakdown = {
      totalStroops: 0,
      disabledStroops: 0,
      unpricedRequests: 0,
    };

    for (const [key, requests] of usageStore.entries()) {
      const parts = usagePartsFromStoreKey(tenantId, key);
      if (!parts) continue;
      const serviceKey = tenantServiceKey(tenantId, parts.serviceId);
      const service = servicesStore.get(serviceKey);
      if (!service) {
        breakdown.unpricedRequests += requests;
        continue;
      }

      const billedStroops = requests * service.priceStroops;
      breakdown.totalStroops += billedStroops;
      if (servicesDisabled.has(serviceKey)) {
        breakdown.disabledStroops += billedStroops;
      }
    }
    res.json(breakdown);
  });

  router.get("/api/v1/billing/:agent/:serviceId", (req: Request, res: Response) => {
    const { agent, serviceId } = req.params;
    const tenantId = resolveTenantId(req);
    const requests = usageStore.get(usageKey(agent, serviceId, tenantId)) ?? 0;
    const price =
      servicesStore.get(tenantServiceKey(tenantId, serviceId))?.priceStroops ?? 0;
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
    const tenantId = resolveTenantId(req);
    if (typeof agent !== "string" || typeof serviceId !== "string") {
      res.status(400).json({
        error: "invalid_request",
        message: "agent and serviceId are required strings",
        requestId,
      });
      return;
    }
    const service = servicesStore.get(tenantServiceKey(tenantId, serviceId));
    if (!service) {
      sendServiceNotFound(req, res, serviceId);
      return;
    }
    const key = usageKey(agent, serviceId, tenantId);
    const requests = usageStore.get(key) ?? 0;
    const price = service.priceStroops;
    const billedStroops = requests * price;
    usageStore.set(key, 0);
    recordEvent("usage.settled", { agent, serviceId, requests, billedStroops });
    res.json({ agent, serviceId, requests, priceStroops: price, billedStroops });
  });

  router.get("/api/v1/agents", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    const limit = Math.min(
      1000,
      Math.max(1, Number((req.query.limit as string) ?? 200))
    );
    const seen = new Set<string>();
    for (const key of usageStore.keys()) {
      const parts = usagePartsFromStoreKey(tenantId, key);
      if (parts) seen.add(parts.agent);
    }
    const agents = Array.from(seen).slice(0, limit);
    res.json({ agents });
  });

  router.get("/api/v1/agents/:agent/total", (req: Request, res: Response) => {
    const { agent } = req.params;
    const tenantId = resolveTenantId(req);
    let total = 0;
    for (const [key, n] of usageStore.entries()) {
      const parts = usagePartsFromStoreKey(tenantId, key);
      if (parts?.agent === agent) total += n;
    }
    res.json({ agent, total });
  });

  router.get("/api/v1/agents/:agent/usage", (req: Request, res: Response) => {
    const { agent } = req.params;
    const tenantId = resolveTenantId(req);
    const items: { serviceId: string; total: number }[] = [];
    for (const [key, total] of usageStore.entries()) {
      const parts = usagePartsFromStoreKey(tenantId, key);
      if (parts?.agent === agent) {
        items.push({ serviceId: parts.serviceId, total });
      }
    }
    res.json({ agent, items });
  });

  return router;
}
