import { Router, type Request, type Response } from "express";
import { renderHttpMetrics } from "../metrics.js";
import {
  apiKeyStore,
  lifetimeRequests,
  parseServiceKey,
  pauseState,
  servicesStore,
  settlementCounters,
  usageStore,
  webhookStore,
} from "../store/state.js";
import { etagFor } from "../httpCache.js";
import { scanUsageStore } from "../usageScan.js";
import { rejectUnknownQueryParams } from "../middleware/validate.js";
import { parseIntParam } from "../queryParams.js";
import { paginateByCursor } from "../cursorPagination.js";
import { getRequestId } from "../types.js";

const DEFAULT_SERVICES_BREAKDOWN_LIMIT = 50;
const MAX_SERVICES_BREAKDOWN_LIMIT = 500;

type ServiceBreakdownEntry = {
  tenantId: string;
  serviceId: string;
  priceStroops: number;
  requestsOutstanding: number;
};

/** Builds the stable, key-ordered per-service usage breakdown. */
function buildServicesBreakdown(): ServiceBreakdownEntry[] {
  const outstandingByService = new Map<string, number>();
  for (const { serviceId, total } of scanUsageStore()) {
    outstandingByService.set(
      serviceId,
      (outstandingByService.get(serviceId) ?? 0) + total
    );
  }
  return Array.from(servicesStore.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, meta]) => {
      const { tenantId, serviceId } = parseServiceKey(key);
      return {
        tenantId,
        serviceId,
        priceStroops: meta.priceStroops,
        requestsOutstanding: outstandingByService.get(serviceId) ?? 0,
      };
    });
}

function breakdownCursorKey(entry: ServiceBreakdownEntry): string {
  return `${entry.tenantId}::${entry.serviceId}`;
}

/**
 * Builds operational metrics and aggregate stats routes.
 */
export function createMetricsRouter(): Router {
  const router = Router();

  router.get("/api/v1/metrics", rejectUnknownQueryParams([]), (_req, res: Response) => {
    let totalRequests = 0;
    for (const v of usageStore.values()) totalRequests += v;
    const lines = [
      "# HELP agentpay_services_total Number of registered services.",
      "# TYPE agentpay_services_total gauge",
      `agentpay_services_total ${servicesStore.size}`,
      "# HELP agentpay_api_keys_total Number of registered API keys.",
      "# TYPE agentpay_api_keys_total gauge",
      `agentpay_api_keys_total ${apiKeyStore.size}`,
      "# HELP agentpay_webhooks_total Number of registered webhooks.",
      "# TYPE agentpay_webhooks_total gauge",
      `agentpay_webhooks_total ${webhookStore.size}`,
      "# HELP agentpay_usage_keys_total Number of distinct usage store keys.",
      "# TYPE agentpay_usage_keys_total gauge",
      `agentpay_usage_keys_total ${usageStore.size}`,
      "# HELP agentpay_usage_requests_total Outstanding (unsettled) request counters.",
      "# TYPE agentpay_usage_requests_total gauge",
      `agentpay_usage_requests_total ${totalRequests}`,
      "# HELP agentpay_requests_recorded_total Monotonic total requests metered.",
      "# TYPE agentpay_requests_recorded_total counter",
      `agentpay_requests_recorded_total ${lifetimeRequests}`,
      "# HELP agentpay_settled_stroops_total Lifetime settled value in stroops.",
      "# TYPE agentpay_settled_stroops_total counter",
      `agentpay_settled_stroops_total ${settlementCounters.settledStroopsTotal.toString()}`,
      "# HELP agentpay_settlements_total Lifetime settlement operations.",
      "# TYPE agentpay_settlements_total counter",
      `agentpay_settlements_total ${settlementCounters.settlementsTotal}`,
      "# HELP agentpay_paused 1 if the backend is paused, 0 otherwise.",
      "# TYPE agentpay_paused gauge",
      `agentpay_paused ${pauseState.paused ? 1 : 0}`,
      ...renderHttpMetrics(),
    ];
    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(lines.join("\n") + "\n");
  });

  router.get(
    "/api/v1/stats",
    rejectUnknownQueryParams(["limit", "cursor"]),
    (req: Request, res: Response) => {
      let totalRequests = 0;
      const agents = new Set<string>();
      for (const { agent, total } of scanUsageStore()) {
        totalRequests += total;
        agents.add(agent);
      }

      const limit = parseIntParam(req.query.limit, {
        defaultValue: DEFAULT_SERVICES_BREAKDOWN_LIMIT,
        min: 1,
        max: MAX_SERVICES_BREAKDOWN_LIMIT,
      });
      const cursorRaw =
        typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      const allBreakdown = buildServicesBreakdown();
      const paged = paginateByCursor(allBreakdown, cursorRaw, limit, breakdownCursorKey);
      if (!paged.ok) {
        res.status(400).json({
          error: "invalid_request",
          message:
            paged.reason === "malformed"
              ? "cursor is malformed"
              : "cursor is invalid or expired",
          requestId: getRequestId(req),
        });
        return;
      }

      const bodyShape = {
        totalServices: servicesStore.size,
        totalApiKeys: apiKeyStore.size,
        totalWebhooks: webhookStore.size,
        usageKeys: usageStore.size,
        totalRequests,
        lifetimeRequests: lifetimeRequests,
        uniqueAgents: agents.size,
        settledStroopsTotal: settlementCounters.settledStroopsTotal.toString(),
        settlementsTotal: settlementCounters.settlementsTotal,
        paused: pauseState.paused,
        servicesBreakdown: paged.page,
        servicesBreakdownTotal: allBreakdown.length,
        nextServicesBreakdownCursor: paged.nextCursor,
      };
      const body = JSON.stringify(bodyShape);
      const etag = etagFor({ body: bodyShape, query: { limit, cursor: cursorRaw ?? null } });
      if (req.header("if-none-match") === etag) {
        res.status(304).end();
        return;
      }
      res.setHeader("ETag", etag);
      res.type("application/json").send(body);
    }
  );

  return router;
}
