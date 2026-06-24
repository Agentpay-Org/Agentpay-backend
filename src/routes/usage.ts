import { Router, type Request, type Response } from "express";
import { recordEvent } from "../events.js";
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

type ValidUsageItem = {
  agent: string;
  serviceId: string;
  requests: number;
};

type UsageInput = {
  agent?: unknown;
  serviceId?: unknown;
  requests?: unknown;
};

type UsageValidationError =
  | "invalid_agent"
  | "invalid_serviceId"
  | "invalid_requests"
  | "service_disabled";

type UsageValidationResult =
  | ({ ok: true } & ValidUsageItem)
  | { ok: false; error: UsageValidationError };

/**
 * Validates usage writes for both single and bulk ingestion paths so identifier
 * length caps and disabled-service checks cannot drift between endpoints.
 */
function validateUsageItem(input: UsageInput): UsageValidationResult {
  const { agent, serviceId, requests } = input;
  if (typeof agent !== "string" || agent.length === 0 || agent.length > 256) {
    return { ok: false, error: "invalid_agent" };
  }
  if (
    typeof serviceId !== "string" ||
    serviceId.length === 0 ||
    serviceId.length > 128
  ) {
    return { ok: false, error: "invalid_serviceId" };
  }
  if (typeof requests !== "number" || !Number.isInteger(requests) || requests <= 0) {
    return { ok: false, error: "invalid_requests" };
  }
  if (servicesDisabled.has(serviceId)) {
    return { ok: false, error: "service_disabled" };
  }
  return { ok: true, agent, serviceId, requests };
}

function usageValidationMessage(error: UsageValidationError, serviceId?: string): string {
  switch (error) {
    case "invalid_agent":
      return "agent must be a non-empty string up to 256 chars";
    case "invalid_serviceId":
      return "serviceId must be a non-empty string up to 128 chars";
    case "invalid_requests":
      return "requests must be a positive integer";
    case "service_disabled":
      return `service ${serviceId ?? "unknown"} is currently disabled`;
  }
}

/**
 * Builds usage, billing, settlement, and agent rollup routes.
 */
export function createUsageRouter(): Router {
  const router = Router();

  router.post("/api/v1/usage", (req: Request, res: Response) => {
    const body = (req.body ?? {}) as UsageInput;
    const result = validateUsageItem(body);
    const requestId = getRequestId(req);

    if (!result.ok) {
      const status = result.error === "service_disabled" ? 409 : 400;
      const error = result.error === "service_disabled" ? "service_disabled" : "invalid_request";
      res.status(status).json({
        error,
        message: usageValidationMessage(
          result.error,
          typeof body.serviceId === "string" ? body.serviceId : undefined
        ),
        requestId,
      });
      return;
    }

    const { agent, serviceId, requests } = result;
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
      const result = validateUsageItem((items[i] ?? {}) as UsageInput);
      if (!result.ok) {
        results.push({
          index: i,
          ok: false,
          error: result.error === "service_disabled" ? "service_disabled" : "invalid_item",
        });
        continue;
      }
      const { agent, serviceId, requests } = result;
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
    const limit = Math.min(
      1000,
      Math.max(1, Number((req.query.limit as string) ?? 200))
    );
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
