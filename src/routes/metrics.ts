import { Router, type Response } from "express";
import {
  apiKeyStore,
  pauseState,
  servicesStore,
  usageStore,
  webhookStore,
} from "../store/state.js";

/**
 * Builds operational metrics and aggregate stats routes.
 */
export function createMetricsRouter(): Router {
  const router = Router();

  router.get("/api/v1/metrics", (_req, res: Response) => {
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
      "# HELP agentpay_settled_stroops_total Lifetime settled value in stroops.",
      "# TYPE agentpay_settled_stroops_total counter",
      `agentpay_settled_stroops_total ${settlementCounters.settledStroopsTotal.toString()}`,
      "# HELP agentpay_settlements_total Lifetime settlement operations.",
      "# TYPE agentpay_settlements_total counter",
      `agentpay_settlements_total ${settlementCounters.settlementsTotal}`,
      "# HELP agentpay_paused 1 if the backend is paused, 0 otherwise.",
      "# TYPE agentpay_paused gauge",
      `agentpay_paused ${pauseState.paused ? 1 : 0}`,
    ];
    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(lines.join("\n") + "\n");
  });

  router.get("/api/v1/stats", (_req, res: Response) => {
    let totalRequests = 0;
    const agents = new Set<string>();
    for (const [key, total] of usageStore.entries()) {
      totalRequests += total;
      const parts = usagePartsFromAnyStoreKey(key);
      if (parts) agents.add(parts.agent);
    }
    res.json({
      totalServices: servicesStore.size,
      totalApiKeys: apiKeyStore.size,
      totalWebhooks: webhookStore.size,
      usageKeys: usageStore.size,
      totalRequests,
      lifetimeRequests: lifetimeRequests.total,
      uniqueAgents: agents.size,
      settledStroopsTotal: settlementCounters.settledStroopsTotal.toString(),
      settlementsTotal: settlementCounters.settlementsTotal,
      paused: pauseState.paused,
    });
  });

  return router;
}
