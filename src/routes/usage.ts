import { Router, type Request, type Response } from "express";
import { isValidAgentId, isValidServiceId } from "../identifiers.js";
import { recordEvent } from "../events.js";
import { parseIntParam } from "../queryParams.js";
import {
  config,
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

  router.post(
    "/api/v1/usage",
    validateBody(requestBodySchemas.usageRecord),
    (req: Request, res: Response) => {
      const { agent, serviceId, requests } = req.body as UsageRecordBody;
      const requestId = getRequestId(req);

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
        !isValidAgentId(agent) ||
        !isValidServiceId(serviceId) ||
        typeof requests !== "number" ||
        !Number.isInteger(requests) ||
        requests <= 0
      ) {
        results.push({ index: i, ok: false, error: "invalid_item" });
        continue;
      }

      const key = usageKey(agent, serviceId);
      const prev = usageStore.get(key) ?? 0;
      const total = Math.min(Number.MAX_SAFE_INTEGER, prev + requests);
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
    if (
      rejectInvalidPathIdentifier(req, res, "agent", agent) ||
      rejectInvalidPathIdentifier(req, res, "serviceId", serviceId)
    ) {
      return;
    }
    const total = usageStore.get(usageKey(agent, serviceId)) ?? 0;
    res.json({ agent, serviceId, total });
  });

  /**
   * Clears one recorded usage accumulator without producing billing output.
   */
  router.delete("/api/v1/usage/:agent/:serviceId", (req: Request, res: Response) => {
    const { agent, serviceId } = req.params;
    const requestId = getRequestId(req);
    const key = usageKey(agent, serviceId);
    if (!usageStore.has(key)) {
      res.status(404).json({
        error: "not_found",
        message: `usage accumulator for ${agent}/${serviceId} was not recorded`,
        requestId,
      });
      return;
    }
    const clearedTotal = usageStore.get(key) ?? 0;
    usageStore.set(key, 0);
    recordEvent("usage.reset", { agent, serviceId, clearedTotal });
    res.json({ agent, serviceId, clearedTotal });
  });

  router.get("/api/v1/usage/export.csv", (_req, res: Response) => {
    const rows: string[] = ["agent,serviceId,total"];
    for (const [key, total] of usageStore.entries()) {
      const [agent, serviceId] = key.split("::");
      rows.push(`${escapeCsvField(agent)},${escapeCsvField(serviceId)},${total}`);
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=usage.csv");
    res.send(rows.join("\n") + "\n");
  });

  router.get("/api/v1/usage/export.json", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    const items: { agent: string; serviceId: string; total: number }[] = [];
    for (const { agent, serviceId, total } of scanUsageStore()) {
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

    for (const { serviceId, total: requests } of scanUsageStore()) {
      const service = servicesStore.get(serviceId);
      if (!service) {
        breakdown.unpricedRequests += requests;
        continue;
      }

      const billedStroops = multiplyStroops(requests, service.priceStroops);
      breakdown.totalStroops = addStroops(breakdown.totalStroops, billedStroops);
      if (servicesDisabled.has(serviceId)) {
        breakdown.disabledStroops = addStroops(
          breakdown.disabledStroops,
          billedStroops
        );
      }
    }
    res.json(breakdown);
  });

  router.get("/api/v1/billing/:agent/:serviceId", (req: Request, res: Response) => {
    const { agent, serviceId } = req.params;
    if (
      rejectInvalidPathIdentifier(req, res, "agent", agent) ||
      rejectInvalidPathIdentifier(req, res, "serviceId", serviceId)
    ) {
      return;
    }
    const requests = usageStore.get(usageKey(agent, serviceId)) ?? 0;
    const price = service.priceStroops;
    res.json({
      agent,
      serviceId,
      requests,
      priceStroops: price,
      billedStroops: multiplyStroops(requests, price),
    });
  });

  router.post("/api/v1/settle", (req: Request, res: Response) => {
    const { agent, serviceId } = req.body ?? {};
    const requestId = getRequestId(req);
    if (!isValidAgentId(agent) || !isValidServiceId(serviceId)) {
      res.status(400).json({
        error: "invalid_request",
        message: "agent and serviceId must be safe identifiers",
        requestId,
      });
      return;
    }
    const key = usageKey(agent, serviceId);
    const requests = usageStore.get(key) ?? 0;
    const price = servicesStore.get(serviceId)?.priceStroops ?? 0;
    const billedStroops = multiplyStroops(requests, price);
    usageStore.set(key, 0);
    recordEvent("usage.settled", { agent, serviceId, requests, billedStroops });
    res.json({ agent, serviceId, requests, priceStroops: price, billedStroops });
  });

  router.get("/api/v1/agents", (req: Request, res: Response) => {
    const limit = parseIntParam(req.query.limit, {
      defaultValue: 200,
      min: 1,
      max: 1000,
    });
    const seen = new Set<string>();
    for (const { agent } of scanUsageStore()) seen.add(agent);
    const agents = Array.from(seen).slice(0, limit);
    res.json({ agents });
  });

  router.get("/api/v1/agents/:agent/total", (req: Request, res: Response) => {
    const { agent } = req.params;
    if (rejectInvalidPathIdentifier(req, res, "agent", agent)) return;
    const prefix = `${agent}::`;
    let total = 0;
    for (const entry of scanByAgent(agent)) {
      total += entry.total;
    }
    res.json({ agent, total });
  });

  router.get("/api/v1/agents/:agent/usage", (req: Request, res: Response) => {
    const { agent } = req.params;
    if (rejectInvalidPathIdentifier(req, res, "agent", agent)) return;
    const prefix = `${agent}::`;
    const items: { serviceId: string; total: number }[] = [];
    for (const { serviceId, total } of scanByAgent(agent)) {
      items.push({ serviceId, total });
    }
    res.json({ agent, items });
  });

  return router;
}
