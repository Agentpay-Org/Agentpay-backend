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

## Authentication

By default the API remains open for local development. Set
`REQUIRE_API_KEY=true` to require a valid `X-API-Key` on every non-read request
while keeping `GET`, `HEAD`, and `OPTIONS` open for dashboards and health
checks.

Create tenant API keys with `POST /api/v1/api-keys` before enabling
enforcement. The backend stores only SHA-256 hashes of generated keys and lists
only each key's 8-character prefix.

Admin writes under `POST /api/v1/admin/*` are privileged when enforcement is
enabled. They require `X-API-Key` to match `ADMIN_API_KEY`; tenant API keys are
not accepted for those routes.

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
