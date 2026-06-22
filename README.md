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

3. **Configure environment variables**:

   ```bash
   cp .env.example .env
   ```

   The example file contains safe local defaults. Real `.env` files stay ignored by git.

4. **Verify setup**:

   ```bash
   npm run build
   npm test
   ```

5. **Run locally**:
   ```bash
   npm run dev
   ```
   Server runs at `http://localhost:3001`. Try `GET /health` and `GET /api/v1/version`.

## Configuration

The service currently reads these environment variables in `src/index.ts`:

| Variable | Default | Effect |
| --- | --- | --- |
| `PORT` | `3001` | Port used when the app starts directly from `src/index.ts` or the compiled `dist/index.js`. |
| `NODE_ENV` | unset | When set to `test`, rate limiting and structured request logging are skipped so automated tests stay deterministic. |
| `CORS_ALLOWED_ORIGINS` | empty string | Comma-separated list of allowed request origins. An empty list means same-origin-only behavior; matching origins receive `Access-Control-Allow-Origin` and related CORS headers. |

`.env.example` is safe to commit and mirrors the variables above. Real local files such as `.env` and `.env.local` remain ignored by `.gitignore`; the repository explicitly unignores `.env.example` so contributors can copy it.

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

