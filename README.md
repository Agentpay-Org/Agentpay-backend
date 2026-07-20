# AgentPay Backend

API gateway, metering, and billing backend for the AgentPay protocol (machine-to-machine payments on Stellar).

## Overview

- **Stack:** Node.js, Express, TypeScript
- **Endpoints:** Health check, version, and placeholders for usage/billing APIs

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

## Configuration

The backend reads these environment variables at runtime. For local development,
copy [`.env.example`](.env.example) to `.env` and adjust values as needed. The
real `.env` files stay ignored by git; `.env.example` contains only safe
placeholders.

| Variable | Default | Purpose |
| -------- | ------- | ------- |
| `PORT` | `3001` | HTTP listen port used by `src/index.ts` when the server starts. |
| `CORS_ALLOWED_ORIGINS` | empty | Comma-separated allowlist for browser CORS origins. When empty, the backend does not emit `Access-Control-Allow-Origin`; when an incoming `Origin` exactly matches an entry, the middleware echoes that origin and related CORS headers. |
| `NODE_ENV` | unset | Runtime mode. Set to `test` only for automated tests; in test mode the in-process rate limiter is skipped and per-request JSON logs are suppressed. |

### OpenAPI route index

The server exposes a hand-written OpenAPI 3.0.3 document at `GET /api/v1/openapi.json`
that lists every registered primary route with summary lines. A CI test
(`src/openapi-routes.test.ts`) walks the Express router stack and asserts the
document is in parity — all registered routes appear in the paths object — so
additions or removals of routes must be reflected in the handler at
`src/routes/meta.ts`.

## Project structure

```
agentpay-backend/
├── src/
│   ├── index.ts          # Thin Express composition root that exports app
│   ├── auth/             # API-key hashing, creation, and constant-time checks
│   ├── events.ts         # Bounded in-memory audit event log helpers
│   ├── middleware/       # CORS, security headers, request id, pause, rate limit
│   ├── routes/           # Feature routers for admin, usage, services, keys, webhooks
│   ├── store/            # In-memory stores and shared state helpers
│   ├── health.test.ts    # App-level regression tests
│   └── services.test.ts  # Service registry tests
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

## Running with Docker

Build a production image from the repository root:

```bash
docker build -t agentpay-backend .
```

Run it locally, publishing the API on `http://localhost:3001`:

```bash
docker run --rm --name agentpay-backend -p 3001:3001 -e PORT=3001 agentpay-backend
```

Check the container health endpoint:

```bash
curl -fsS http://localhost:3001/health
```

The runtime image contains only production dependencies and the compiled
`dist/` output, runs as the non-root `node` user, and uses `SIGTERM` as the
stop signal so the application graceful-shutdown handler can drain in-flight
requests. Pass configuration with `-e NAME=value` or `--env-file`; real `.env`
files are ignored by Docker builds and must not be baked into image layers.

## Documentation

- [Architecture and settlement flow](docs/architecture.md) explains the
  in-memory data model, middleware/request lifecycle, off-chain metering flow,
  and where durable storage plus on-chain settlement should plug in.
- [Billing units and settlement semantics](docs/billing-units.md) explains
  stroops, `priceStroops`, `billedStroops`, `/api/v1/billing/*`, and why
  `POST /api/v1/settle` drains backend counters without moving funds.
- [Idempotency keys](docs/idempotency.md) documents retry-safe billing writes
  for `POST /api/v1/usage`, `POST /api/v1/usage/bulk`, and
  `POST /api/v1/settle`.

## Multi-tenancy

Service registration, service metadata, disabled-state mutations, usage
accumulators, per-service rollups, billing quotes, and settlement are scoped to
the authenticated tenant. A tenant is derived from a recognized `X-API-Key`; the
API key is hashed internally before it is used as an in-memory store key, so the
secret is not exposed in responses or logs. When no valid key is supplied, the
backend preserves local-development behavior by using a shared `public` tenant.

Cross-tenant reads and mutations return `404 not_found` instead of `403`, so a
caller cannot use the API to enumerate another tenant's `serviceId`s. Different
tenants may safely register the same public `serviceId`; each tenant receives its
own price, metadata, disabled flag, usage counters, and settlement balance.

## Quickstart

Start a local backend on `http://localhost:3001` with the checked-in
dependencies:

```bash
npm run build
npm start
```

The API is open by default for local development and demos. Add your own
`X-Request-Id` header when you want to correlate client logs with backend
responses. The backend echoes the value on success and structured errors.
Write requests with a body must send `Content-Type: application/json`; otherwise
the backend returns `415 unsupported_media_type`. Bodyless writes, such as
`POST /api/v1/admin/pause`, do not need a content type.

Every request that passes through the API rate limiter includes client
self-throttling headers:

- `RateLimit-Limit`: the maximum requests allowed in the current window.
- `RateLimit-Remaining`: the remaining requests for the caller after this
  response.
- `RateLimit-Reset`: seconds until the oldest in-window request expires and
  capacity is restored.

When the caller is limited, the `429 rate_limited` response also includes
`Retry-After` with the same resolved seconds as `RateLimit-Reset`. These values
are derived only from the caller's own in-memory bucket.

## Health and readiness probes

Use `GET /health` as the liveness probe. It returns `200` while the process is
running, including during graceful shutdown drain, so supervisors can tell the
process itself is still alive.

Use `GET /api/v1/health/ready` as the readiness probe. It returns
`200 { "ready": true }` during normal operation and
`503 { "ready": false }` after `SIGTERM` or `SIGINT` starts graceful shutdown.
The readiness response intentionally exposes only the boolean readiness signal.
It is independent from the admin pause flag, which only gates write traffic.

Example Kubernetes probes:

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3001
readinessProbe:
  httpGet:
    path: /api/v1/health/ready
    port: 3001
```

## Observability Headers

Every routed response includes a coarse `Server-Timing` header such as
`app;dur=2.4`. The value is set before response headers are flushed and reports
only total application handling time in milliseconds; it does not expose route
internals, service identifiers, API keys, agents, or billing details.

Write endpoints use shared request-body schemas before route handlers run. The
same schema registry backs the OpenAPI request-body components, rejects unknown
fields, and preserves the existing `400 invalid_request` response shape with a
client `message` and `requestId`.

### Authentication

Set `REQUIRE_API_KEY=true` to require credentials on state-changing routes.
`GET`, `HEAD`, and `OPTIONS` remain open for dashboards, health checks, and
metadata readers. Non-admin write routes require a valid tenant key in the
`X-API-Key` header:

```bash
curl -sS -X POST "$BASE_URL/api/v1/usage" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $AGENTPAY_API_KEY" \
  -d '{"agent":"agent-alpha","serviceId":"embedding-v1","requests":3}'
```

Tenant keys are returned once from `POST /api/v1/api-keys`. The in-memory store
keeps only a SHA-256 hash plus the public 8-character prefix, and
`GET /api/v1/api-keys` never returns the live secret.

Set `ADMIN_API_KEY` alongside `REQUIRE_API_KEY=true` for privileged writes.
`POST /api/v1/admin/*` and API-key creation/revocation require this admin key
instead of a tenant key:

```bash
curl -sS -X POST "$BASE_URL/api/v1/api-keys" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ADMIN_API_KEY" \
  -d '{"label":"ops"}'
```

Structured logs default to `info` outside tests and `silent` in
`NODE_ENV=test`. Set `LOG_LEVEL` to one of `fatal`, `error`, `warn`, `info`,
`debug`, `trace`, or `silent` to override the default.

Set a shell variable for the local base URL:

```bash
BASE_URL=http://localhost:3001
```

### Running behind a proxy

By default the backend does not trust `X-Forwarded-For`, so spoofed proxy
headers cannot change the rate-limit key. When the service is deployed behind a
load balancer or reverse proxy that you control, set `TRUST_PROXY` to the number
of trusted proxy hops:

```bash
TRUST_PROXY=1 npm start
```

Truthy values such as `true`, `yes`, and `on` are treated as one trusted hop.
Leave `TRUST_PROXY` unset, `0`, or `false` for direct-to-node deployments.

Rate limiting prefers a recognized `X-API-Key` over the client IP, so two valid
API-key tenants behind the same NAT do not throttle each other. Requests without
a recognized key continue to use Express' trusted client IP. Only enable
`TRUST_PROXY` behind a proxy that strips or overwrites inbound
`X-Forwarded-For`; otherwise clients can choose the address Express sees.

1. Register a billable service.

   ```bash
   curl -sS -X POST "$BASE_URL/api/v1/services" \
     -H "Content-Type: application/json" \
     -H "X-Request-Id: quickstart-register" \
     -d '{"serviceId":"embedding-v1","priceStroops":25}'
   ```

   Expected status: `201 Created`

   ```json
   {
     "serviceId": "embedding-v1",
     "priceStroops": 25
   }
   ```

   You may also include `description` and `owner` in the same request to create
   service metadata atomically with registration. Both metadata fields must be
   supplied together; `description` must be a string up to 256 characters and
   `owner` must be a non-empty string up to 256 characters. Invalid metadata
   rejects the entire request with `400 invalid_request` and does not register
   the service.

   Bulk registration is available at `POST /api/v1/services/bulk` with an
   `items` array controlled by the runtime `bulkMaxItems` config. The default
   limit is 100 items, and `PATCH /api/v1/config` accepts `bulkMaxItems` values
   from 1 to 1000. The same active limit applies to `POST /api/v1/usage/bulk`.
   Bulk endpoints keep their partial-success response contract: valid unique
   items are applied, invalid items report `invalid_item`, and later occurrences
   of a duplicate `serviceId` in the same batch report `duplicate_in_batch`
   without overwriting the first item.

   Numeric request bodies are bounded before they enter counters or billing
   math. `requests` must be a positive integer up to 1,000,000 per call.
   `priceStroops` must be a non-negative integer up to 9,007,199,254. Those
   paired limits keep a single request's `requests * priceStroops` calculation
   inside JavaScript's safe integer range. Bulk endpoints reject only the
   offending item and keep valid items in the same batch.

2. Record usage for an agent.

   ```bash
   curl -sS -X POST "$BASE_URL/api/v1/usage" \
     -H "Content-Type: application/json" \
     -H "X-Request-Id: quickstart-usage-1" \
     -d '{"agent":"agent-alpha","serviceId":"embedding-v1","requests":3}'
   ```

   Expected status: `201 Created`

   ```json
   {
     "agent": "agent-alpha",
     "serviceId": "embedding-v1",
     "total": 3
   }
   ```

3. Record more usage for the same agent and service.

   ```bash
   curl -sS -X POST "$BASE_URL/api/v1/usage" \
     -H "Content-Type: application/json" \
     -H "X-Request-Id: quickstart-usage-2" \
     -d '{"agent":"agent-alpha","serviceId":"embedding-v1","requests":7}'
   ```

   Expected status: `201 Created`

   ```json
   {
     "agent": "agent-alpha",
     "serviceId": "embedding-v1",
     "total": 10
   }
   ```

4. Read the current accumulator.

   ```bash
   curl -sS "$BASE_URL/api/v1/usage/agent-alpha/embedding-v1" \
     -H "X-Request-Id: quickstart-read"
   ```

   Expected status: `200 OK`

   ```json
   {
     "agent": "agent-alpha",
     "serviceId": "embedding-v1",
     "total": 10
   }
   ```

5. Quote the current bill.

   ```bash
   curl -sS "$BASE_URL/api/v1/billing/agent-alpha/embedding-v1" \
     -H "X-Request-Id: quickstart-quote"
   ```

   Expected status: `200 OK`

   ```json
   {
     "agent": "agent-alpha",
     "serviceId": "embedding-v1",
     "requests": 10,
     "priceStroops": 25,
     "billedStroops": "250"
   }
   ```

   Unknown services return `404 not_found` instead of being priced at zero.

6. Settle the bill and drain the accumulator.

   ```bash
   curl -sS -X POST "$BASE_URL/api/v1/settle" \
     -H "Content-Type: application/json" \
     -H "X-Request-Id: quickstart-settle" \
     -d '{"agent":"agent-alpha","serviceId":"embedding-v1"}'
   ```

   Expected status: `200 OK`

   ```json
   {
     "agent": "agent-alpha",
     "serviceId": "embedding-v1",
     "requests": 10,
     "priceStroops": 25,
     "billedStroops": "250"
   }
   ```

   Settlement for an unknown service returns `404 not_found` and leaves the
   outstanding usage accumulator unchanged.

7. Confirm the accumulator is now zero.

   ```bash
   curl -sS "$BASE_URL/api/v1/usage/agent-alpha/embedding-v1" \
     -H "X-Request-Id: quickstart-drained"
   ```

   Expected status: `200 OK`

   ```json
   {
     "agent": "agent-alpha",
     "serviceId": "embedding-v1",
     "total": 0
   }
   ```

## Webhooks

The backend supports outbound webhooks. When registering or updating a webhook, the `events` array must contain only strings from the known event taxonomy. The currently supported event types are:

- `usage.recorded`: Emitted when new usage is recorded for a service.
- `usage.settled`: Emitted when a usage bill is settled and counters are drained.
- `webhook.test`: Emitted via the `/api/v1/webhooks/:id/test` endpoint to verify connectivity.
- `*`: The wildcard wildcard subscribes the webhook to all known event types.

Unknown event types are rejected with a `400 invalid_request` on `POST` and `PATCH`.

## Error responses

Write endpoints return stable JSON envelopes for body-level failures. Malformed
JSON is reported as `400 invalid_request` with the message
`Malformed JSON in request body`; the raw parser message and request body are not
echoed back to clients. Bodies over the 100 KiB JSON limit remain
`413 payload_too_large`.

Unhandled server exceptions are logged with the request id, method, path, error
message, and stack trace. Client-facing `500 internal_error` responses keep the
request id for correlation but always use the generic message
`Unexpected server error` so internal paths or secrets from exception messages
are not leaked.

## CI/CD

On push/PR to `main`, GitHub Actions runs:

| Step    | Command                        | Notes                                |
| ------- | ------------------------------ | ------------------------------------ |
| Install | `npm ci`                       | Clean, reproducible install          |
| Audit   | `npm audit --audit-level=high` | Fails on high or critical advisories |
| Lint    | `npm run lint`                 | ESLint over TS source and tests      |
| Build   | `npm run build`                | TypeScript compile                   |
| Test    | `npm test`                     | Node built-in test runner            |

Node.js is pinned to **20.x LTS** in CI, which satisfies the `engines >= 18.18` requirement declared in `package.json`.

## Security / dependency update policy

### Runtime response headers

The API installs Helmet on every route before request IDs, API-key recognition,
rate limiting, or feature routers run. The configured policy preserves the
existing HSTS preload policy, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, and `Referrer-Policy: no-referrer` behavior
while adding a JSON-API-oriented `Content-Security-Policy`:

- `default-src 'none'` denies document subresources by default.
- `frame-ancestors 'none'` prevents the API from being embedded in frames.
- explicit `script-src 'none'`, `style-src 'none'`, and related directives keep
  inline script/style and `eval` unavailable if a browser renders an API
  response.

`Permissions-Policy` stays explicit at
`geolocation=(), camera=(), microphone=()`. The policy is applied to JSON
responses, CSV/JSON downloads, and Prometheus metrics text exposition.

### Vulnerability audit

Every CI run executes `npm audit --audit-level=high`. A **high** or **critical** advisory blocks the build and must be resolved before merging.

**Triage process for unfixable advisories:**

1. Confirm no patched version exists (`npm audit` output or the advisory page).
2. Assess actual exploitability in context (e.g. is the vulnerable code path reachable?).
3. If the risk is accepted temporarily, document the advisory ID, rationale, and target resolution date in `.github/audit-allowlist.md` and lower the threshold to `--audit-level=critical` in `ci.yml` as a short-term exception.
4. Re-evaluate on every Dependabot PR or at most every 30 days.

Low/moderate advisories are surfaced in the output but do not block the build. They should be reviewed periodically and resolved when a fix is available.

### Automated dependency updates (Dependabot)

Dependabot is configured in `.github/dependabot.yml` and runs every **Monday at 06:00 UTC** for both ecosystems:

| Ecosystem        | Grouping                          | Separate PRs for    |
| ---------------- | --------------------------------- | ------------------- |
| `npm`            | Minor + patch bundled into one PR | Major version bumps |
| `github-actions` | All action updates in one PR      | —                   |

- PRs are labelled `dependencies` + `security` (npm) or `ci` (actions).
- Major version bumps get individual PRs so breaking changes receive explicit review.
- The open-PR cap is 10 (npm) and 5 (actions) to keep the queue manageable.

## Contributing

1. Fork the repo and create a branch.
2. Make changes; ensure `npm run lint`, `npm run build`, and `npm test` pass.
3. Run `npm audit` locally and resolve any high/critical findings before opening a PR.
4. Open a pull request. CI (including the audit step) must pass before merge.

## License

MIT
