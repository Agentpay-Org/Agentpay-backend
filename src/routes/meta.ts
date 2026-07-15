import { Router, type Response } from "express";
import {
  jsonRequestBodyRef,
  openApiRequestBodyComponents,
} from "../schemas/requestBodies.js";
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
            "Billing stroop amounts are returned as exact decimal strings.",
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
          patch: {
            summary: "Update runtime config",
            requestBody: jsonRequestBodyRef("configPatch"),
          },
        },
        "/api/v1/services": {
          get: { summary: "List services" },
          post: {
            summary: "Register a service",
            requestBody: jsonRequestBodyRef("serviceCreate"),
          },
        },
        "/api/v1/services/bulk": {
          post: {
            summary: "Register services in bulk",
            requestBody: jsonRequestBodyRef("bulkServices"),
          },
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
          patch: {
            summary: "Update price only",
            requestBody: jsonRequestBodyRef("servicePricePatch"),
          },
        },
        "/api/v1/services/{serviceId}/metadata": {
          get: { summary: "Read service metadata" },
          put: {
            summary: "Set service metadata",
            requestBody: jsonRequestBodyRef("serviceMetadataPut"),
          },
        },
        "/api/v1/services/{serviceId}/disabled": {
          patch: {
            summary: "Enable or disable a service",
            requestBody: jsonRequestBodyRef("serviceDisabledPatch"),
          },
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
        "/api/v1/usage": {
          post: {
            summary: "Record usage",
            requestBody: jsonRequestBodyRef("usageRecord"),
          },
        },
        "/api/v1/usage/bulk": {
          post: {
            summary: "Batched record",
            requestBody: jsonRequestBodyRef("bulkUsage"),
          },
        },
        "/api/v1/usage/{agent}/{serviceId}": { get: { summary: "Read accumulator" } },
        "/api/v1/billing/total": {
          get: {
            summary: "Quote protocol-wide outstanding bill",
            responses: {
              "200": {
                description:
                  "Billing totals with decimal-string stroop amounts for exact JSON precision.",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BillingTotal" },
                  },
                },
              },
            },
          },
        },
        "/api/v1/billing/{agent}/{serviceId}": {
          get: {
            summary: "Quote bill",
            responses: {
              "200": {
                description:
                  "Pair billing quote with billedStroops serialized as a decimal string.",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BillingQuote" },
                  },
                },
              },
            },
          },
        },
        "/api/v1/settle": {
          post: {
            summary: "Drain & quote bill",
            responses: {
              "200": {
                description:
                  "Settlement quote with billedStroops serialized as a decimal string.",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/BillingQuote" },
                  },
                },
              },
            },
          },
        },
        "/api/v1/api-keys": {
          get: { summary: "List api keys" },
          post: {
            summary: "Create api key",
            requestBody: jsonRequestBodyRef("apiKeyCreate"),
          },
        },
        "/api/v1/api-keys/{prefix}": { delete: { summary: "Revoke by prefix" } },
        "/api/v1/webhooks": {
          get: { summary: "List webhooks" },
          post: {
            summary: "Register webhook",
            requestBody: jsonRequestBodyRef("webhookCreate"),
          },
        },
        "/api/v1/webhooks/{id}": {
          delete: { summary: "Unregister webhook" },
          patch: {
            summary: "Update webhook",
            requestBody: jsonRequestBodyRef("webhookPatch"),
          },
        },
        "/api/v1/admin/pause": { post: { summary: "Pause writes" } },
        "/api/v1/admin/unpause": { post: { summary: "Resume" } },
        "/api/v1/admin/status": { get: { summary: "Read pause flag" } },
      },
      components: {
        schemas: {
          BillingQuote: {
            type: "object",
            properties: {
              agent: { type: "string" },
              serviceId: { type: "string" },
              requests: { type: "integer", minimum: 0 },
              priceStroops: { type: "integer", minimum: 0 },
              billedStroops: {
                type: "string",
                pattern: "^[0-9]+$",
                description:
                  "Exact decimal stroop amount. String-typed to avoid JSON number precision loss.",
              },
            },
            required: [
              "agent",
              "serviceId",
              "requests",
              "priceStroops",
              "billedStroops",
            ],
          },
          BillingTotal: {
            type: "object",
            properties: {
              totalStroops: {
                type: "string",
                pattern: "^[0-9]+$",
                description:
                  "Exact decimal stroop total. String-typed to avoid JSON number precision loss.",
              },
              disabledStroops: {
                type: "string",
                pattern: "^[0-9]+$",
                description:
                  "Exact decimal stroop total for disabled services included in billing totals.",
              },
              unpricedRequests: { type: "integer", minimum: 0 },
            },
            required: ["totalStroops", "disabledStroops", "unpricedRequests"],
          },
        },
      },
    });
  });

  return router;
}
