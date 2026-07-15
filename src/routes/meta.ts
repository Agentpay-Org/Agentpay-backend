import { Router, type Request, type Response } from "express";
import { isReady } from "../readiness.js";
import { pauseState } from "../store/state.js";

/** Reports whether this process should receive fresh traffic. */
export function handleReadiness(_req: Request, res: Response): void {
  const ready = isReady();
  res.status(ready ? 200 : 503).json({ ready });
}

/**
 * Builds health, version, changelog, and OpenAPI metadata routes.
 */
export function createMetaRouter(): Router {
  const router = Router();

  router.get("/health", (_req, res: Response) => {
    res.json({ status: "ok", service: "agentpay-backend" });
  });

  router.get("/api/v1/health/deep", (_req, res: Response) => {
    const mem = process.memoryUsage();
    res.json({
      status: pauseState.paused ? "paused" : "ok",
      uptimeSeconds: Math.round(process.uptime()),
      memory: {
        rssMb: Math.round(mem.rss / 1024 / 1024),
        heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      },
      pid: process.pid,
      node: process.version,
    });
  });

  router.get("/api/v1/health/ready", handleReadiness);

  router.get("/api/v1/version", (_req, res: Response) => {
    res.json({ version: "1.0.0" });
  });

  router.get("/api/v1/changelog", (_req, res: Response) => {
    res.json({
      entries: [
        {
          version: "1.0.0",
          date: "2026-06-12",
          notes: [
            "Initial production surface: services, usage, billing, settlement.",
            "Admin pause/unpause, API keys, webhooks, event log.",
            "Bulk usage + bulk services, CSV/JSON exports.",
            "Metadata + disabled flag per service.",
          ],
        },
      ],
    });
  });

  /** Serves the hand-written OpenAPI route index for the registered API surface. */
  router.get("/api/v1/openapi.json", (_req, res: Response) => {
    res.json({
      openapi: "3.0.3",
      info: {
        title: "AgentPay Backend",
        version: "1.0.0",
        description: "Metering, billing, and settlement gateway for AgentPay.",
      },
      paths: {
        "/health": { get: { summary: "Shallow health check" } },
        "/api/v1/health/deep": {
          get: { summary: "Deep health with process diagnostics" },
        },
        "/api/v1/health/ready": {
          get: { summary: "Readiness check for load balancers" },
        },
        "/api/v1/version": { get: { summary: "App version" } },
        "/api/v1/changelog": { get: { summary: "Changelog entries" } },
        "/api/v1/openapi.json": { get: { summary: "OpenAPI document" } },
        "/api/v1/stats": { get: { summary: "Aggregate stats snapshot" } },
        "/api/v1/metrics": { get: { summary: "Prometheus metrics" } },
        "/api/v1/events": { get: { summary: "Audit log (?since=&limit=)" } },
        "/api/v1/events/summary": { get: { summary: "Audit log summary" } },
        "/api/v1/config": {
          get: { summary: "Read runtime config" },
          patch: { summary: "Update runtime config" },
        },
        "/api/v1/services": {
          get: { summary: "List services" },
          post: { summary: "Register a service" },
        },
        "/api/v1/services/bulk": { post: { summary: "Bulk register services" } },
        "/api/v1/services/{serviceId}": {
          get: { summary: "Fetch one service" },
          delete: { summary: "Unregister service" },
        },
        "/api/v1/services/{serviceId}/metadata": {
          get: { summary: "Fetch service metadata" },
          put: { summary: "Set service metadata" },
        },
        "/api/v1/services/{serviceId}/price": {
          patch: { summary: "Update price only" },
        },
        "/api/v1/services/{serviceId}/disabled": {
          patch: { summary: "Update disabled state" },
        },
        "/api/v1/services/{serviceId}/usage": {
          get: { summary: "Service usage total" },
        },
        "/api/v1/services/{serviceId}/agents": {
          get: { summary: "List agents on a service" },
        },
        "/api/v1/services/{serviceId}/agents/top": {
          get: { summary: "Top agents on a service" },
        },
        "/api/v1/agents": { get: { summary: "List agents" } },
        "/api/v1/agents/{agent}/usage": { get: { summary: "Per-service usage" } },
        "/api/v1/agents/{agent}/total": { get: { summary: "Lifetime total" } },
        "/api/v1/usage": { post: { summary: "Record usage" } },
        "/api/v1/usage/bulk": { post: { summary: "Batched record" } },
        "/api/v1/usage/{agent}/{serviceId}": {
          get: { summary: "Read accumulator" },
          delete: { summary: "Reset accumulator without billing" },
        },
        "/api/v1/billing/{agent}/{serviceId}": { get: { summary: "Quote bill" } },
        "/api/v1/settle": { post: { summary: "Drain & quote bill" } },
        "/api/v1/api-keys": {
          get: { summary: "Paginated api-key list (?limit=&offset=)" },
          post: { summary: "Create api key" },
        },
        "/api/v1/api-keys/{prefix}": { delete: { summary: "Revoke by prefix" } },
        "/api/v1/webhooks": {
          get: { summary: "Paginated webhook list (?limit=&offset=)" },
          post: { summary: "Register webhook" },
        },
        "/api/v1/webhooks/{id}": {
          delete: { summary: "Unregister webhook" },
          patch: { summary: "Update webhook" },
        },
        "/api/v1/webhooks/{id}/test": {
          post: { summary: "Send webhook test event" },
        },
        "/api/v1/admin/pause": { post: { summary: "Pause writes" } },
        "/api/v1/admin/unpause": { post: { summary: "Resume" } },
        "/api/v1/admin/status": { get: { summary: "Read pause flag" } },
      },
    });
  });

  return router;
}
