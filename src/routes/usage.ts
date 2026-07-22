import { Router, type Request, type Response } from "express";
import { isValidAgentId, isValidServiceId } from "../identifiers.js";
import { recordEvent } from "../events.js";
import { createIdempotencyMiddleware } from "../middleware/idempotency.js";
import { validateBody } from "../middleware/validate.js";
import { isSafeCount } from "../numericLimits.js";
import { parseIntParam } from "../queryParams.js";
import {
  addLifetimeRequests,
  config,
  hasStoreCapacityFor,
  parseUsageKey,
  serviceKey,
  servicesDisabled,
  servicesStore,
  settlementCounters,
  usageKey,
  usageNonZeroKeyCount,
  usageStore,
} from "../store/state.js";
import { resolveTenantId } from "../tenant.js";
import { getRequestId } from "../types.js";
import { requestBodySchemas } from "../schemas/requestBodies.js";

type BulkUsageResult = {
  index: number;
  ok: boolean;
  total?: number;
  error?: string;
};

type BulkUsageBody = {
  items: { agent: string; serviceId: string; requests: number }[];
};

/**
 * Neutralises CSV formula-injection characters by prefixing with a single
 * quote. Follows the OWASP CSV injection guidance.
 */
export function escapeCsvField(value: string): string {
  const needsQuote =
    value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r");

  if (
    value.startsWith("=") ||
    value.startsWith("+") ||
    value.startsWith("-") ||
    value.startsWith("@") ||
    value.startsWith("\t") ||
    value.startsWith("\r")
  ) {
    const neutralised = `'${value}`;
    if (needsQuote) {
      return `"${neutralised.replace(/"/g, '""')}"`;
    }
    return neutralised;
  }

  if (needsQuote) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function invalidIdentifierMessage(kind: "agent" | "serviceId"): string {
  const max = kind === "agent" ? 256 : 128;
  return `${kind} must be 1-${max} chars using only letters, numbers, dot, underscore, or hyphen`;
}

export interface UsageRouterOptions {
  /**
   * When true, stroop-denominated amounts are serialized as JSON numbers where
   * they fit inside Number.MAX_SAFE_INTEGER (falling back to decimal strings
   * only when they exceed it). When false, they are always decimal strings so
   * exact ledger units above 2^53 survive serialization.
   */
  stroopsAsNumber?: boolean;
}

const MAX_SAFE_BIG = BigInt(Number.MAX_SAFE_INTEGER);

export function createUsageRouter(options: UsageRouterOptions = {}): Router {
  const router = Router();
  const idempotency = createIdempotencyMiddleware();
  const stroopsAsNumber = options.stroopsAsNumber ?? false;

  /** Serializes a stroop total honoring the router's number/string policy. */
  const formatStroops = (value: bigint): string | number => {
    if (stroopsAsNumber && value >= 0n && value <= MAX_SAFE_BIG) {
      return Number(value);
    }
    return value.toString();
  };

  /** Returns all usage entries owned by the request's tenant. */
  const tenantUsageEntries = (
    tenantId: string
  ): { agent: string; serviceId: string; total: number }[] => {
    const entries: { agent: string; serviceId: string; total: number }[] = [];
    for (const [key, total] of usageStore.entries()) {
      const parsed = parseUsageKey(key);
      if (parsed.tenantId === tenantId) {
        entries.push({ agent: parsed.agent, serviceId: parsed.serviceId, total });
      }
    }
    return entries;
  };

  const invalidIdentifiers = (req: Request, res: Response): void => {
    res.status(400).json({
      error: "invalid_request",
      message: "agent and serviceId must be safe identifiers",
      requestId: getRequestId(req),
    });
  };

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
    if (!isSafeCount(requests)) {
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
    if (
      !hasStoreCapacityFor(
        usageNonZeroKeyCount(),
        (usageStore.get(key) ?? 0) > 0,
        config.usageStoreMaxKeys
      )
    ) {
      res.status(429).json({
        error: "store_capacity_exceeded",
        message: "usage store capacity exceeded",
        requestId,
      });
      return;
    }
    const prev = usageStore.get(key) ?? 0;
    const total = Math.min(Number.MAX_SAFE_INTEGER, prev + requests);
    usageStore.set(key, total);
    addLifetimeRequests(requests);

    recordEvent("usage.recorded", { agent, serviceId, requests, total });
    res.status(201).json({ agent, serviceId, total });
  });

  /**
   * Records usage for up to config.bulkMaxItems agent/service pairs in a single
   * batch.  The active limit is controlled by PATCH /api/v1/config (default 100,
   * max 1000).  Invalid items are reported individually without failing the rest.
   */
  router.post(
    "/api/v1/usage/bulk",
    idempotency,
    validateBody(requestBodySchemas.bulkUsage),
    (req: Request, res: Response) => {
      const requestId = getRequestId(req);
      const tenantId = resolveTenantId(req);
      const { items } = req.body as BulkUsageBody;
      if (items.length > config.bulkMaxItems) {
        res.status(400).json({
          error: "invalid_request",
          message: `items must be a non-empty array of up to ${config.bulkMaxItems} entries`,
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
          !isSafeCount(requests)
        ) {
          results.push({ index: i, ok: false, error: "invalid_item" });
          continue;
        }
        if (servicesDisabled.has(serviceKey(tenantId, serviceId))) {
          results.push({ index: i, ok: false, error: "service_disabled" });
          continue;
        }
        const key = usageKey(tenantId, agent, serviceId);
        if (
          !hasStoreCapacityFor(
            usageNonZeroKeyCount(),
            (usageStore.get(key) ?? 0) > 0,
            config.usageStoreMaxKeys
          )
        ) {
          results.push({ index: i, ok: false, error: "store_capacity_exceeded" });
          continue;
        }
        const total = Math.min(
          Number.MAX_SAFE_INTEGER,
          (usageStore.get(key) ?? 0) + requests
        );
        usageStore.set(key, total);
        addLifetimeRequests(requests);
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

  router.post("/api/v1/settle", idempotency, (req: Request, res: Response) => {
    const { agent, serviceId } = req.body ?? {};
    const tenantId = resolveTenantId(req);
    if (!isValidAgentId(agent) || !isValidServiceId(serviceId)) {
      invalidIdentifiers(req, res);
      return;
    }
    const key = usageKey(tenantId, agent, serviceId);
    const requests = usageStore.get(key) ?? 0;
    const price = servicesStore.get(serviceKey(tenantId, serviceId))?.priceStroops ?? 0;
    const stroops = BigInt(requests) * BigInt(price);
    usageStore.set(key, 0);
    settlementCounters.settledStroopsTotal += Number(stroops);
    settlementCounters.settlementsTotal += 1;
    const billedStroops = formatStroops(stroops);
    recordEvent("usage.settled", { agent, serviceId, requests, billedStroops });
    res.json({ agent, serviceId, requests, priceStroops: price, billedStroops });
  });

  /**
   * Drains every outstanding service for a single agent in one settlement pass.
   * Unregistered services are settled at a zero price so their counters clear.
   */
  router.post("/api/v1/settle/bulk", idempotency, (req: Request, res: Response) => {
    const { agent } = req.body ?? {};
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    if (!isValidAgentId(agent)) {
      res.status(400).json({
        error: "invalid_request",
        message: "agent must be a safe identifier",
        requestId,
      });
      return;
    }
    const entries = tenantUsageEntries(tenantId).filter((e) => e.agent === agent);
    let totalBilled = 0n;
    const items = entries.map((entry) => {
      const service = servicesStore.get(serviceKey(tenantId, entry.serviceId));
      const price = service?.priceStroops ?? 0;
      const stroops = BigInt(entry.total) * BigInt(price);
      totalBilled += stroops;
      usageStore.set(usageKey(tenantId, agent, entry.serviceId), 0);
      settlementCounters.settledStroopsTotal += Number(stroops);
      settlementCounters.settlementsTotal += 1;
      const billedStroops = formatStroops(stroops);
      recordEvent("usage.settled", {
        agent,
        serviceId: entry.serviceId,
        requests: entry.total,
        billedStroops,
        bulk: true,
      });
      return {
        serviceId: entry.serviceId,
        requests: entry.total,
        priceStroops: price,
        billedStroops,
      };
    });
    res.json({ agent, items, totalBilledStroops: formatStroops(totalBilled) });
  });

  router.get("/api/v1/usage/export.json", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    res.setHeader("Content-Disposition", "attachment; filename=usage.json");
    res.json({ exportedAt: Date.now(), items: tenantUsageEntries(tenantId) });
  });

  router.get("/api/v1/usage/export.csv", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    const rows = tenantUsageEntries(tenantId).map(
      (entry) =>
        `${escapeCsvField(entry.agent)},${escapeCsvField(entry.serviceId)},${entry.total}`
    );
    res.setHeader("Content-Disposition", "attachment; filename=usage.csv");
    res.type("text/csv").send(["agent,serviceId,total", ...rows].join("\n") + "\n");
  });

  router.get("/api/v1/billing/total", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    let totalStroops = 0n;
    let disabledStroops = 0n;
    let unpricedRequests = 0;
    for (const entry of tenantUsageEntries(tenantId)) {
      const key = serviceKey(tenantId, entry.serviceId);
      const service = servicesStore.get(key);
      if (!service) {
        unpricedRequests += entry.total;
        continue;
      }
      const stroops = BigInt(entry.total) * BigInt(service.priceStroops);
      totalStroops += stroops;
      if (servicesDisabled.has(key)) {
        disabledStroops += stroops;
      }
    }
    res.json({
      totalStroops: formatStroops(totalStroops),
      disabledStroops: formatStroops(disabledStroops),
      unpricedRequests,
    });
  });

  router.get("/api/v1/billing/:agent/:serviceId", (req: Request, res: Response) => {
    const agent = String(req.params.agent);
    const serviceId = String(req.params.serviceId);
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    if (!isValidAgentId(agent) || !isValidServiceId(serviceId)) {
      invalidIdentifiers(req, res);
      return;
    }
    const service = servicesStore.get(serviceKey(tenantId, serviceId));
    if (!service) {
      res.status(404).json({
        error: "not_found",
        message: `service ${serviceId} is not registered`,
        requestId,
      });
      return;
    }
    const requests = usageStore.get(usageKey(tenantId, agent, serviceId)) ?? 0;
    const stroops = BigInt(requests) * BigInt(service.priceStroops);
    res.json({
      agent,
      serviceId,
      requests,
      priceStroops: service.priceStroops,
      billedStroops: formatStroops(stroops),
    });
  });

  router.get("/api/v1/agents", (req: Request, res: Response) => {
    const tenantId = resolveTenantId(req);
    const limit = parseIntParam(req.query.limit, {
      defaultValue: 100,
      min: 1,
      max: 1000,
    });
    const seen = new Set<string>();
    const agents: string[] = [];
    for (const entry of tenantUsageEntries(tenantId)) {
      if (!seen.has(entry.agent)) {
        seen.add(entry.agent);
        agents.push(entry.agent);
      }
    }
    res.json({ agents: agents.slice(0, limit) });
  });

  router.get("/api/v1/agents/:agent/total", (req: Request, res: Response) => {
    const agent = String(req.params.agent);
    const tenantId = resolveTenantId(req);
    if (!isValidAgentId(agent)) {
      invalidIdentifiers(req, res);
      return;
    }
    let total = 0;
    for (const entry of tenantUsageEntries(tenantId)) {
      if (entry.agent === agent) total += entry.total;
    }
    res.json({ agent, total });
  });

  router.get("/api/v1/agents/:agent/usage", (req: Request, res: Response) => {
    const agent = String(req.params.agent);
    const tenantId = resolveTenantId(req);
    if (!isValidAgentId(agent)) {
      invalidIdentifiers(req, res);
      return;
    }
    const items = tenantUsageEntries(tenantId)
      .filter((entry) => entry.agent === agent)
      .map((entry) => ({ serviceId: entry.serviceId, total: entry.total }));
    res.json({ agent, items });
  });

  router.get("/api/v1/usage/:agent/:serviceId", (req: Request, res: Response) => {
    const agent = String(req.params.agent);
    const serviceId = String(req.params.serviceId);
    const tenantId = resolveTenantId(req);
    if (!isValidAgentId(agent) || !isValidServiceId(serviceId)) {
      invalidIdentifiers(req, res);
      return;
    }
    const total = usageStore.get(usageKey(tenantId, agent, serviceId)) ?? 0;
    res.json({ agent, serviceId, total });
  });

  router.delete("/api/v1/usage/:agent/:serviceId", (req: Request, res: Response) => {
    const agent = String(req.params.agent);
    const serviceId = String(req.params.serviceId);
    const requestId = getRequestId(req);
    const tenantId = resolveTenantId(req);
    if (!isValidAgentId(agent) || !isValidServiceId(serviceId)) {
      invalidIdentifiers(req, res);
      return;
    }
    const key = usageKey(tenantId, agent, serviceId);
    if (!usageStore.has(key)) {
      res.status(404).json({
        error: "not_found",
        message: `no usage recorded for ${agent}/${serviceId}`,
        requestId,
      });
      return;
    }
    const clearedTotal = usageStore.get(key) ?? 0;
    usageStore.set(key, 0);
    recordEvent("usage.reset", { agent, serviceId, clearedTotal });
    res.json({ agent, serviceId, clearedTotal });
  });

  return router;
}