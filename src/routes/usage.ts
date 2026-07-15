import { Router, type Request, type Response } from "express";
import { isValidAgentId, isValidServiceId } from "../identifiers.js";
import { recordEvent } from "../events.js";
import { createIdempotencyMiddleware } from "../middleware/idempotency.js";
import {
  parseUsageKey,
  serviceKey,
  servicesDisabled,
  servicesStore,
  usageKey,
  usageStore,
} from "../store/state.js";
import { resolveTenantId } from "../tenant.js";
import { getRequestId } from "../types.js";
import { addStroops, multiplyStroops } from "../util/stroops.js";

type BulkUsageResult = {
  index: number;
  ok: boolean;
  total?: number;
  error?: string;
};

type UsageItemValidation =
  | { ok: true; agent: string; serviceId: string; requests: number }
  | { ok: false; message: string };

type BillingTotalBreakdown = {
  totalStroops: string;
  disabledStroops: string;
  unpricedRequests: number;
};

function invalidIdentifierMessage(kind: "agent" | "serviceId"): string {
  const max = kind === "agent" ? 256 : 128;
  return `${kind} must be 1-${max} chars using only letters, numbers, dot, underscore, or hyphen`;
}

function rejectInvalidPathIdentifier(
  req: Request,
  res: Response,
  kind: "agent" | "serviceId",
  value: unknown
): boolean {
  const valid = kind === "agent" ? isValidAgentId(value) : isValidServiceId(value);
  if (valid) return false;

  res.status(400).json({
    error: "invalid_request",
    message: invalidIdentifierMessage(kind),
    requestId: getRequestId(req),
  });
  return true;
}

/**
 * Builds usage, billing, settlement, and agent rollup routes.
 */
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

    recordEvent("usage.recorded", { agent, serviceId, requests, total });
    res.status(201).json({ agent, serviceId, total });
  });

  router.post("/api/v1/usage/bulk", idempotency, (req: Request, res: Response) => {
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

      recordEvent("usage.recorded", { agent, serviceId, requests, total });
      res.status(201).json({ agent, serviceId, total });
    }
  );

  router.post(
    "/api/v1/usage/bulk",
    validateBody(requestBodySchemas.bulkUsage),
    (req: Request, res: Response) => {
      const { items } = req.body as BulkUsageBody;
      const results: BulkUsageResult[] = [];
      for (let i = 0; i < items.length; i++) {
        const { agent, serviceId, requests } = (items[i] ?? {}) as {
          agent?: unknown;
          serviceId?: unknown;
          requests?: unknown;
        };
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
    }
  );

  router.get("/api/v1/usage/:agent/:serviceId", (req: Request, res: Response) => {
    const { agent, serviceId } = req.params;
    const tenantId = resolveTenantId(req);
    const total = usageStore.get(usageKey(tenantId, agent, serviceId)) ?? 0;
    res.json({ agent, serviceId, total });
  });

  router.get("/api/v1/usage/export.csv", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows: string[] = ["agent,serviceId,total"];
    for (const [key, total] of usageStore.entries()) {
      const { tenantId: itemTenantId, agent, serviceId } = parseUsageKey(key);
      if (itemTenantId !== tenantId) continue;
      rows.push(`${escape(agent)},${escape(serviceId)},${total}`);
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=usage.csv");
    res.send(rows.join("\n") + "\n");
  });

  router.get("/api/v1/usage/export.json", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    const items: { agent: string; serviceId: string; total: number }[] = [];
    for (const [key, total] of usageStore.entries()) {
      const { tenantId: itemTenantId, agent, serviceId } = parseUsageKey(key);
      if (itemTenantId !== tenantId) continue;
      items.push({ agent, serviceId, total });
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
      totalStroops: "0",
      disabledStroops: "0",
      unpricedRequests: 0,
    };

    for (const [key, requests] of usageStore.entries()) {
      const parsed = parseUsageKey(key);
      if (parsed.tenantId !== tenantId) continue;
      const service = servicesStore.get(serviceKey(tenantId, parsed.serviceId));
      if (!service) {
        breakdown.unpricedRequests += requests;
        continue;
      }

      const billedStroops = requests * service.priceStroops;
      breakdown.totalStroops += billedStroops;
      if (servicesDisabled.has(serviceKey(tenantId, parsed.serviceId))) {
        breakdown.disabledStroops += billedStroops;
      }
    }
    res.json(breakdown);
  });

  router.get("/api/v1/billing/:agent/:serviceId", (req: Request, res: Response) => {
    const { agent, serviceId } = req.params;
    const tenantId = resolveTenantId(req);
    const requests = usageStore.get(usageKey(tenantId, agent, serviceId)) ?? 0;
    const price = servicesStore.get(serviceKey(tenantId, serviceId))?.priceStroops ?? 0;
    res.json({
      agent,
      serviceId,
      requests,
      priceStroops: price,
      billedStroops: multiplyStroops(requests, price),
    });
  });

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

  router.get("/api/v1/agents", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    const limit = Math.min(
      1000,
      Math.max(1, Number((req.query.limit as string) ?? 200))
    );
    const seen = new Set<string>();
    for (const key of usageStore.keys()) {
      const parsed = parseUsageKey(key);
      if (parsed.tenantId === tenantId) seen.add(parsed.agent);
    }
    const agents = Array.from(seen).slice(0, limit);
    res.json({ agents });
  });

  router.get("/api/v1/agents/:agent/total", (req: Request, res: Response) => {
    const { agent } = req.params;
    const tenantId = resolveTenantId(req);
    let total = 0;
    for (const [key, n] of usageStore.entries()) {
      const parsed = parseUsageKey(key);
      if (parsed.tenantId === tenantId && parsed.agent === agent) total += n;
    }
    res.json({ agent, total });
  });

  router.get("/api/v1/agents/:agent/usage", (req: Request, res: Response) => {
    const { agent } = req.params;
    const tenantId = resolveTenantId(req);
    const items: { serviceId: string; total: number }[] = [];
    for (const [key, total] of usageStore.entries()) {
      const parsed = parseUsageKey(key);
      if (parsed.tenantId === tenantId && parsed.agent === agent) {
        items.push({ serviceId: parsed.serviceId, total });
      }
    }
    res.json({ agent, items });
  });

  return router;
}
