# AgentPay Backend

API gateway, metering, and billing backend for the AgentPay protocol (machine-to-machine payments on Stellar).

## Overview

- **Stack:** Node.js, Express, TypeScript
- **Endpoints:** Health, runtime config, usage, billing, settlement, services, API keys, webhooks, events, admin, metrics, and OpenAPI docs

## Prerequisites

- Node.js 18.18+
- npm

## Setup for contributors

1. **Clone the repo** (or add remote and pull):

   ```bash
   git clone <repo-url> && cd agentpay-backend
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Verify setup**:

   ```bash
   npm run build
   npm test
   ```

4. **Run locally**:
   ```bash
   npm run dev
   ```
   Server runs at `http://localhost:3001`. Try `GET /health` and `GET /api/v1/version`.

## API reference

The live OpenAPI document is served at `GET /api/v1/openapi.json`. The table
below uses the same `{param}` path placeholder style as OpenAPI.

Current storage is in-memory and non-durable: usage counters, services, service
metadata, API keys, webhook registrations, event logs, runtime config, and the
pause flag reset on process restart. Do not expose state-changing endpoints to
untrusted clients without an authentication or gateway layer in front of this
service.

Standard JSON errors use:

```json
{ "error": "invalid_request", "message": "human-readable detail", "requestId": "..." }
```

Common status codes are `400` for invalid input, `404` for missing resources,
`409` for disabled-service conflicts, `413` for request bodies over 100 KiB,
`429` for rate limiting, `503` while writes are paused, and `500` for unexpected
server errors.

<!-- api-reference:start -->

| Group    | Method | Path                                      | Purpose                                 | Key fields                                                                                                     |
| -------- | ------ | ----------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Health   | GET    | `/health`                                 | Shallow health check                    | Response: `status`, `service`                                                                                  |
| Health   | GET    | `/api/v1/health/deep`                     | Process diagnostics                     | Response: `status`, `uptimeSeconds`, `memory`, `pid`, `node`                                                   |
| Health   | GET    | `/api/v1/version`                         | Application version                     | Response: `version`                                                                                            |
| Health   | GET    | `/api/v1/changelog`                       | Hand-maintained release notes           | Response: `entries[]`                                                                                          |
| Docs     | GET    | `/api/v1/openapi.json`                    | OpenAPI 3.0 path map                    | Response: `openapi`, `info`, `paths`                                                                           |
| Runtime  | GET    | `/api/v1/config`                          | Read mutable runtime config             | Response: `config.rateLimitPerWindow`, `config.rateLimitWindowMs`, `config.bulkMaxItems`, `config.eventLogCap` |
| Runtime  | PATCH  | `/api/v1/config`                          | Update selected runtime config values   | Body: `rateLimitPerWindow`, `rateLimitWindowMs`, `bulkMaxItems`; response: `config`                            |
| Runtime  | GET    | `/api/v1/stats`                           | Aggregate dashboard snapshot            | Response: `totalServices`, `totalApiKeys`, `totalRequests`, `uniqueAgents`, `paused`                           |
| Runtime  | GET    | `/api/v1/metrics`                         | Prometheus text exposition              | Response: `text/plain; version=0.0.4`                                                                          |
| Admin    | POST   | `/api/v1/admin/pause`                     | Pause state-changing writes             | Response: `paused`                                                                                             |
| Admin    | POST   | `/api/v1/admin/unpause`                   | Resume state-changing writes            | Response: `paused`                                                                                             |
| Admin    | GET    | `/api/v1/admin/status`                    | Read pause flag                         | Response: `paused`                                                                                             |
| Usage    | POST   | `/api/v1/usage`                           | Record usage for one agent/service pair | Body: `agent`, `serviceId`, `requests`; response: `agent`, `serviceId`, `total`                                |
| Usage    | POST   | `/api/v1/usage/bulk`                      | Record up to 100 usage items            | Body: `items[]`; response: `results[]` with per-index status                                                   |
| Usage    | GET    | `/api/v1/usage/{agent}/{serviceId}`       | Read accumulated usage                  | Response: `agent`, `serviceId`, `total`                                                                        |
| Usage    | GET    | `/api/v1/usage/export.csv`                | Download all usage as CSV               | Response columns: `agent`, `serviceId`, `total`                                                                |
| Usage    | GET    | `/api/v1/usage/export.json`               | Download all usage as JSON              | Response: `exportedAt`, `items[]`                                                                              |
| Billing  | GET    | `/api/v1/billing/total`                   | Sum outstanding billing across usage    | Response: `totalStroops`                                                                                       |
| Billing  | GET    | `/api/v1/billing/{agent}/{serviceId}`     | Quote outstanding bill without draining | Response: `agent`, `serviceId`, `requests`, `priceStroops`, `billedStroops`                                    |
| Billing  | POST   | `/api/v1/settle`                          | Drain usage and return billed amount    | Body: `agent`, `serviceId`; response: `requests`, `priceStroops`, `billedStroops`                              |
| Agents   | GET    | `/api/v1/agents`                          | List agents observed in usage           | Query: `limit`; response: `agents[]`                                                                           |
| Agents   | GET    | `/api/v1/agents/{agent}/total`            | Sum usage across services for an agent  | Response: `agent`, `total`                                                                                     |
| Agents   | GET    | `/api/v1/agents/{agent}/usage`            | List per-service usage for an agent     | Response: `agent`, `items[]`                                                                                   |
| Services | GET    | `/api/v1/services`                        | List registered services                | Query: `prefix`, `q`, `limit`; response: `services[]`; supports `ETag` / `If-None-Match`                       |
| Services | POST   | `/api/v1/services`                        | Register or upsert a service            | Body: `serviceId`, `priceStroops`; response: `serviceId`, `priceStroops`                                       |
| Services | POST   | `/api/v1/services/bulk`                   | Register up to 50 services              | Body: `items[]`; response: `results[]`                                                                         |
| Services | GET    | `/api/v1/services/{serviceId}`            | Fetch one service                       | Response: `serviceId`, `priceStroops`                                                                          |
| Services | DELETE | `/api/v1/services/{serviceId}`            | Unregister one service                  | Response: `204 No Content`                                                                                     |
| Services | PATCH  | `/api/v1/services/{serviceId}/price`      | Update only service price               | Body: `priceStroops`; response: `serviceId`, `priceStroops`                                                    |
| Services | PATCH  | `/api/v1/services/{serviceId}/disabled`   | Toggle service write blocking           | Body: `disabled`; response: `serviceId`, `disabled`                                                            |
| Services | PUT    | `/api/v1/services/{serviceId}/metadata`   | Set service metadata                    | Body: `description`, `owner`; response: `serviceId`, `description`, `owner`                                    |
| Services | GET    | `/api/v1/services/{serviceId}/metadata`   | Read service metadata                   | Response: `serviceId`, `description`, `owner`                                                                  |
| Services | GET    | `/api/v1/services/{serviceId}/usage`      | Roll up usage for one service           | Response: `serviceId`, `total`, `agents`                                                                       |
| Services | GET    | `/api/v1/services/{serviceId}/agents`     | List agents using a service             | Response: `serviceId`, `items[]`                                                                               |
| Services | GET    | `/api/v1/services/{serviceId}/agents/top` | List top agents by service usage        | Query: `limit`; response: `serviceId`, `items[]`                                                               |
| API keys | GET    | `/api/v1/api-keys`                        | List key metadata without secrets       | Response: `items[]` with `prefix`, `label`, `createdAt`                                                        |
| API keys | POST   | `/api/v1/api-keys`                        | Create an opaque API key                | Body: `label`; response: `key`, `label`                                                                        |
| API keys | DELETE | `/api/v1/api-keys/{prefix}`               | Revoke a key by 8-character prefix      | Response: `204 No Content`                                                                                     |
| Events   | GET    | `/api/v1/events`                          | Read audit events                       | Query: `since`, `type`, `limit`; response: `items[]`                                                           |
| Events   | GET    | `/api/v1/events/summary`                  | Count events by type                    | Response: `counts`, `total`                                                                                    |
| Webhooks | GET    | `/api/v1/webhooks`                        | List registered webhooks                | Response: `items[]`                                                                                            |
| Webhooks | POST   | `/api/v1/webhooks`                        | Register a webhook                      | Body: `url`, `events[]`; response: `id`, `url`, `events`                                                       |
| Webhooks | PATCH  | `/api/v1/webhooks/{id}`                   | Update webhook URL or events            | Body: `url`, `events[]`; response: `id`, `url`, `events`, `createdAt`                                          |
| Webhooks | DELETE | `/api/v1/webhooks/{id}`                   | Unregister a webhook                    | Response: `204 No Content`                                                                                     |
| Webhooks | POST   | `/api/v1/webhooks/{id}/test`              | Record a synthetic webhook test event   | Response: `id`, `deliveredAt`, `simulated`                                                                     |

<!-- api-reference:end -->

## Project structure

```
agentpay-backend/
├── src/
│   ├── index.ts          # Express app and routes
│   └── health.test.ts    # Tests
├── package.json
├── tsconfig.json
└── .github/workflows/
    └── ci.yml            # CI: build, test
```

## Commands

| Command          | Description                                 |
| ---------------- | ------------------------------------------- |
| `npm run build`  | Compile TypeScript to `dist/`               |
| `npm run lint`   | Run ESLint over TypeScript source and tests |
| `npm run format` | Check formatting with Prettier              |
| `npm test`       | Build and run tests                         |
| `npm run dev`    | Run with ts-node                            |
| `npm start`      | Run production build                        |

## CI/CD

On push/PR to `main`, GitHub Actions runs:

- `npm ci`
- `npm run lint`
- `npm run build`
- `npm test`

## Contributing

1. Fork the repo and create a branch.
2. Make changes; ensure `npm run lint`, `npm run build`, and `npm test` pass.
3. Open a pull request. CI must pass before merge.

## License

MIT
