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

## Runtime configuration

`GET /api/v1/config` returns the active in-memory runtime configuration.
`PATCH /api/v1/config` accepts positive integer updates for supported keys.

`bulkMaxItems` defaults to `100` and is capped at `1000` to avoid
memory-exhaustion batches. The value controls both `POST /api/v1/usage/bulk`
and `POST /api/v1/services/bulk`; changes take effect on the next request.
Requests with zero items or more than the active limit return the existing
`400 invalid_request` response shape with a message that includes the active
limit. At-limit batches keep the existing per-item partial-success response.

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
