import { Router, type Response } from "express";
import { renderHttpMetrics } from "../metrics.js";
import { apiKeyStore, pauseState, servicesStore, usageStore } from "../store/state.js";

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
      "# HELP agentpay_usage_requests_total Outstanding (unsettled) request counters.",
      "# TYPE agentpay_usage_requests_total gauge",
      `agentpay_usage_requests_total ${totalRequests}`,
      "# HELP agentpay_paused 1 if the backend is paused, 0 otherwise.",
      "# TYPE agentpay_paused gauge",
      `agentpay_paused ${pauseState.paused ? 1 : 0}`,
      ...renderHttpMetrics(),
    ];
    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(lines.join("\n") + "\n");
  });

  router.get("/api/v1/stats", (_req, res: Response) => {
    let totalRequests = 0;
    const agents = new Set<string>();
    for (const [key, total] of usageStore.entries()) {
      totalRequests += total;
      agents.add(key.split("::")[0]);
    }
    res.json({
      totalServices: servicesStore.size,
      totalApiKeys: apiKeyStore.size,
      totalRequests,
      uniqueAgents: agents.size,
      paused: pauseState.paused,
    });
  });

  return router;
}
