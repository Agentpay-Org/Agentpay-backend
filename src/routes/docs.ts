import { Router, type Request, type Response } from "express";

const CONTRACT_ID =
  process.env.AGENTPAY_CONTRACT_ID ??
  "CAWQI63RISS2AXF2YSH77RQGUMVMXIAJUIDBW4DTVSTYU2L5TLCAMXNU";

/** Key endpoints advertised from the API root. */
const ENDPOINTS: Record<string, string> = {
  "GET /": "This endpoint index",
  "GET /docs": "Interactive API documentation (Swagger UI)",
  "GET /health": "Shallow liveness check",
  "GET /api/v1/health/deep": "Deep health with subsystem checks",
  "GET /api/v1/health/ready": "Readiness probe",
  "GET /api/v1/openapi.json": "OpenAPI 3 document",
  "GET /api/v1/version": "Build version",
  "GET /api/v1/stats": "Aggregate usage and billing stats",
  "GET /api/v1/metrics": "Prometheus metrics",
  "GET /api/v1/config": "Runtime configuration",
  "GET /api/v1/services": "List registered services",
  "POST /api/v1/services": "Register a paid service",
  "POST /api/v1/usage": "Record metered usage for an agent",
  "GET /api/v1/usage/{agent}/{serviceId}": "Read an agent's usage for a service",
  "GET /api/v1/events": "Audit event log",
  "GET /api/v1/webhooks": "List webhook subscriptions",
};

const DOCS_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; connect-src 'self'; font-src 'self' https://cdn.jsdelivr.net data:; frame-ancestors 'none'";

const DOCS_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AgentPay API Docs</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>body{margin:0;background:#fafafa}.topbar{display:none}header{padding:16px 24px;background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif}header a{color:#a5b4fc}</style>
</head>
<body>
  <header><strong>AgentPay API</strong> &middot; metering, billing &amp; settlement gateway &middot; contract <a href="https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}">${CONTRACT_ID.slice(0, 8)}&hellip;</a> &middot; <a href="/api/v1/openapi.json">openapi.json</a></header>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>window.ui = SwaggerUIBundle({ url: "/api/v1/openapi.json", dom_id: "#swagger-ui" });</script>
</body>
</html>`;

/** Root endpoint index and human-readable API docs. */
export function createDocsRouter(): Router {
  const router = Router();

  router.get("/", (_req: Request, res: Response) => {
    res.json({
      name: "AgentPay Backend",
      description:
        "API gateway, usage metering, billing and settlement for machine-to-machine payments on Stellar.",
      version: "1.0.0",
      docs: "/docs",
      openapi: "/api/v1/openapi.json",
      health: "/health",
      storage: "in-memory (resets on cold start)",
      contract: {
        network: "testnet",
        contractId: CONTRACT_ID,
        explorer: `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`,
      },
      endpoints: ENDPOINTS,
    });
  });

  router.get(["/docs", "/docs/"], (_req: Request, res: Response) => {
    res.setHeader("Content-Security-Policy", DOCS_CSP);
    res.type("html").send(DOCS_HTML);
  });

  return router;
}
