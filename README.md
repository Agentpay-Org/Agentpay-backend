# AgentPay Backend

API gateway, metering, and billing backend for the AgentPay protocol (machine-to-machine payments on Stellar).

## Overview

- **Stack:** Node.js, Express, TypeScript
- **Endpoints:** Health check, version, usage, service registry, billing, and settlement APIs

## Billing amount precision

Billing endpoints serialize stroop amounts as decimal strings, not JSON numbers:

- `GET /api/v1/billing/:agent/:serviceId` returns `billedStroops: string`.
- `POST /api/v1/settle` returns `billedStroops: string`.
- `GET /api/v1/billing/total` returns `totalStroops: string`.

This avoids JSON number precision loss when request counts and per-request prices produce totals above `Number.MAX_SAFE_INTEGER`. Request counts and `priceStroops` inputs still use safe non-negative JSON integers. See [docs/billing.md](docs/billing.md).

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
