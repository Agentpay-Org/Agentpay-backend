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
