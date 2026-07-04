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

## Project structure

```
agentpay-backend/
├── src/
│   ├── index.ts          # Thin Express composition root that exports app
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

## Documentation

- [Billing units and settlement semantics](docs/billing-units.md) explains
  stroops, `priceStroops`, `billedStroops`, `/api/v1/billing/*`, and why
  `POST /api/v1/settle` drains backend counters without moving funds.

## Quickstart

Start a local backend on `http://localhost:3001` with the checked-in
dependencies:

```bash
npm run build
npm start
```

The API is currently open for local development and demos. You do not need an
API key for the metering flow until API-key enforcement lands. Add your own
`X-Request-Id` header when you want to correlate client logs with backend
responses. The backend echoes the value on success and structured errors.

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

   Bulk registration is available at `POST /api/v1/services/bulk` with an
   `items` array of 1-50 services. The endpoint keeps its partial-success
   response contract: valid unique items are applied, invalid items report
   `invalid_item`, and later occurrences of a duplicate `serviceId` in the same
   batch report `duplicate_in_batch` without overwriting the first item.

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
     "billedStroops": 250
   }
   ```

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
     "billedStroops": 250
   }
   ```

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
