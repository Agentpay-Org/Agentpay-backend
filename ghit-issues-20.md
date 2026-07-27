---
type: Feature
title: "Add cursor pagination to the usage listing endpoint"
labels: type:feature, area:usage, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate the usage listing

### Description
The usage listing endpoint returns an unbounded array, which does not scale as data grows. This issue adds cursor-based pagination with a bounded page size.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination (bounded default + max page size) to the usage listing.
- Return a stable next-cursor; keep existing filters working across pages.
- Do not change the item shape.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/usage-01-pagination`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: empty set, exact-page boundary, over-limit clamp, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(usage): add cursor pagination`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Validate and bound usage request inputs against malformed payloads"
labels: type:feature, area:usage, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Harden usage input validation

### Description
The usage endpoints accept request bodies with limited validation, risking malformed or oversized inputs reaching the store. This issue adds strict input validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Reject unknown fields, wrong types, and out-of-range values on usage writes with a structured 400.
- Bound string lengths and numeric ranges; return a machine-readable error code.
- Cover the validation in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/usage-02-validation`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: missing field, wrong type, oversized string, boundary numbers.
- Include the full test output in the PR description.

### Example commit message
`feat(usage): validate and bound request inputs`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add tests for the usage endpoint success and error paths"
labels: type:feature, area:usage, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Cover the usage endpoint behaviour

### Description
The usage endpoint family is under-tested around its error and edge paths. This issue adds focused integration tests.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests for success, not-found, validation-failure, and idempotent-repeat paths of usage.
- Assert status codes, error codes, and response shapes.
- Do not change behaviour unless a defect is found (note it).

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/usage-01-endpoint`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: not-found, invalid input, duplicate, empty result.
- Include the full test output in the PR description.

### Example commit message
`test(usage): cover success and error paths`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Document the usage API contract and error codes"
labels: type:docs, area:usage, stack:nodejs, stack:typescript, priority:low, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document the usage API

### Description
The usage endpoints lack a single reference for their request/response shapes and error codes, slowing integrators. This issue documents them.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/usage.md` covering each usage route, its params, response shape, and error codes.
- Cross-reference the handler; keep it accurate to the code.
- Include a request/response example per route.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/usage-01-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify each documented route against source.
- Include the full test output in the PR description.

### Example commit message
`docs(usage): document the API contract`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Extract the shared usage handler validation into a reusable helper"
labels: type:refactor, area:usage, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Deduplicate usage validation

### Description
The usage handlers repeat similar validation preambles inline. This issue extracts a shared, tested validation helper.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Extract the repeated usage validation into a single helper consumed by each handler.
- Behaviour unchanged; same rejections and codes.
- No new dependencies.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/usage-01-validation-helper`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: each existing rejection still fires identically.
- Include the full test output in the PR description.

### Example commit message
`refactor(usage): extract shared validation helper`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add cursor pagination to the billing listing endpoint"
labels: type:feature, area:billing, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate the billing listing

### Description
The billing listing endpoint returns an unbounded array, which does not scale as data grows. This issue adds cursor-based pagination with a bounded page size.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination (bounded default + max page size) to the billing listing.
- Return a stable next-cursor; keep existing filters working across pages.
- Do not change the item shape.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/billing-01-pagination`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: empty set, exact-page boundary, over-limit clamp, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(billing): add cursor pagination`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Validate and bound billing request inputs against malformed payloads"
labels: type:feature, area:billing, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Harden billing input validation

### Description
The billing endpoints accept request bodies with limited validation, risking malformed or oversized inputs reaching the store. This issue adds strict input validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Reject unknown fields, wrong types, and out-of-range values on billing writes with a structured 400.
- Bound string lengths and numeric ranges; return a machine-readable error code.
- Cover the validation in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/billing-02-validation`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: missing field, wrong type, oversized string, boundary numbers.
- Include the full test output in the PR description.

### Example commit message
`feat(billing): validate and bound request inputs`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add tests for the billing endpoint success and error paths"
labels: type:feature, area:billing, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Cover the billing endpoint behaviour

### Description
The billing endpoint family is under-tested around its error and edge paths. This issue adds focused integration tests.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests for success, not-found, validation-failure, and idempotent-repeat paths of billing.
- Assert status codes, error codes, and response shapes.
- Do not change behaviour unless a defect is found (note it).

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/billing-01-endpoint`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: not-found, invalid input, duplicate, empty result.
- Include the full test output in the PR description.

### Example commit message
`test(billing): cover success and error paths`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Document the billing API contract and error codes"
labels: type:docs, area:billing, stack:nodejs, stack:typescript, priority:low, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document the billing API

### Description
The billing endpoints lack a single reference for their request/response shapes and error codes, slowing integrators. This issue documents them.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/billing.md` covering each billing route, its params, response shape, and error codes.
- Cross-reference the handler; keep it accurate to the code.
- Include a request/response example per route.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/billing-01-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify each documented route against source.
- Include the full test output in the PR description.

### Example commit message
`docs(billing): document the API contract`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Extract the shared billing handler validation into a reusable helper"
labels: type:refactor, area:billing, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Deduplicate billing validation

### Description
The billing handlers repeat similar validation preambles inline. This issue extracts a shared, tested validation helper.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Extract the repeated billing validation into a single helper consumed by each handler.
- Behaviour unchanged; same rejections and codes.
- No new dependencies.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/billing-01-validation-helper`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: each existing rejection still fires identically.
- Include the full test output in the PR description.

### Example commit message
`refactor(billing): extract shared validation helper`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add cursor pagination to the services listing endpoint"
labels: type:feature, area:services, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate the services listing

### Description
The services listing endpoint returns an unbounded array, which does not scale as data grows. This issue adds cursor-based pagination with a bounded page size.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination (bounded default + max page size) to the services listing.
- Return a stable next-cursor; keep existing filters working across pages.
- Do not change the item shape.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/services-01-pagination`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: empty set, exact-page boundary, over-limit clamp, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(services): add cursor pagination`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Validate and bound services request inputs against malformed payloads"
labels: type:feature, area:services, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Harden services input validation

### Description
The services endpoints accept request bodies with limited validation, risking malformed or oversized inputs reaching the store. This issue adds strict input validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Reject unknown fields, wrong types, and out-of-range values on services writes with a structured 400.
- Bound string lengths and numeric ranges; return a machine-readable error code.
- Cover the validation in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/services-02-validation`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: missing field, wrong type, oversized string, boundary numbers.
- Include the full test output in the PR description.

### Example commit message
`feat(services): validate and bound request inputs`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add tests for the services endpoint success and error paths"
labels: type:feature, area:services, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Cover the services endpoint behaviour

### Description
The services endpoint family is under-tested around its error and edge paths. This issue adds focused integration tests.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests for success, not-found, validation-failure, and idempotent-repeat paths of services.
- Assert status codes, error codes, and response shapes.
- Do not change behaviour unless a defect is found (note it).

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/services-01-endpoint`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: not-found, invalid input, duplicate, empty result.
- Include the full test output in the PR description.

### Example commit message
`test(services): cover success and error paths`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Document the services API contract and error codes"
labels: type:docs, area:services, stack:nodejs, stack:typescript, priority:low, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document the services API

### Description
The services endpoints lack a single reference for their request/response shapes and error codes, slowing integrators. This issue documents them.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/services.md` covering each services route, its params, response shape, and error codes.
- Cross-reference the handler; keep it accurate to the code.
- Include a request/response example per route.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/services-01-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify each documented route against source.
- Include the full test output in the PR description.

### Example commit message
`docs(services): document the API contract`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Extract the shared services handler validation into a reusable helper"
labels: type:refactor, area:services, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Deduplicate services validation

### Description
The services handlers repeat similar validation preambles inline. This issue extracts a shared, tested validation helper.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Extract the repeated services validation into a single helper consumed by each handler.
- Behaviour unchanged; same rejections and codes.
- No new dependencies.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/services-01-validation-helper`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: each existing rejection still fires identically.
- Include the full test output in the PR description.

### Example commit message
`refactor(services): extract shared validation helper`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add cursor pagination to the agents listing endpoint"
labels: type:feature, area:agents, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate the agents listing

### Description
The agents listing endpoint returns an unbounded array, which does not scale as data grows. This issue adds cursor-based pagination with a bounded page size.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination (bounded default + max page size) to the agents listing.
- Return a stable next-cursor; keep existing filters working across pages.
- Do not change the item shape.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/agents-01-pagination`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: empty set, exact-page boundary, over-limit clamp, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(agents): add cursor pagination`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Validate and bound agents request inputs against malformed payloads"
labels: type:feature, area:agents, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Harden agents input validation

### Description
The agents endpoints accept request bodies with limited validation, risking malformed or oversized inputs reaching the store. This issue adds strict input validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Reject unknown fields, wrong types, and out-of-range values on agents writes with a structured 400.
- Bound string lengths and numeric ranges; return a machine-readable error code.
- Cover the validation in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/agents-02-validation`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: missing field, wrong type, oversized string, boundary numbers.
- Include the full test output in the PR description.

### Example commit message
`feat(agents): validate and bound request inputs`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add tests for the agents endpoint success and error paths"
labels: type:feature, area:agents, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Cover the agents endpoint behaviour

### Description
The agents endpoint family is under-tested around its error and edge paths. This issue adds focused integration tests.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests for success, not-found, validation-failure, and idempotent-repeat paths of agents.
- Assert status codes, error codes, and response shapes.
- Do not change behaviour unless a defect is found (note it).

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/agents-01-endpoint`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: not-found, invalid input, duplicate, empty result.
- Include the full test output in the PR description.

### Example commit message
`test(agents): cover success and error paths`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Document the agents API contract and error codes"
labels: type:docs, area:agents, stack:nodejs, stack:typescript, priority:low, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document the agents API

### Description
The agents endpoints lack a single reference for their request/response shapes and error codes, slowing integrators. This issue documents them.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/agents.md` covering each agents route, its params, response shape, and error codes.
- Cross-reference the handler; keep it accurate to the code.
- Include a request/response example per route.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/agents-01-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify each documented route against source.
- Include the full test output in the PR description.

### Example commit message
`docs(agents): document the API contract`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Extract the shared agents handler validation into a reusable helper"
labels: type:refactor, area:agents, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Deduplicate agents validation

### Description
The agents handlers repeat similar validation preambles inline. This issue extracts a shared, tested validation helper.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Extract the repeated agents validation into a single helper consumed by each handler.
- Behaviour unchanged; same rejections and codes.
- No new dependencies.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/agents-01-validation-helper`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: each existing rejection still fires identically.
- Include the full test output in the PR description.

### Example commit message
`refactor(agents): extract shared validation helper`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add cursor pagination to the config listing endpoint"
labels: type:feature, area:config, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate the config listing

### Description
The config listing endpoint returns an unbounded array, which does not scale as data grows. This issue adds cursor-based pagination with a bounded page size.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination (bounded default + max page size) to the config listing.
- Return a stable next-cursor; keep existing filters working across pages.
- Do not change the item shape.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/config-01-pagination`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: empty set, exact-page boundary, over-limit clamp, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(config): add cursor pagination`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Validate and bound config request inputs against malformed payloads"
labels: type:feature, area:config, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Harden config input validation

### Description
The config endpoints accept request bodies with limited validation, risking malformed or oversized inputs reaching the store. This issue adds strict input validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Reject unknown fields, wrong types, and out-of-range values on config writes with a structured 400.
- Bound string lengths and numeric ranges; return a machine-readable error code.
- Cover the validation in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/config-02-validation`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: missing field, wrong type, oversized string, boundary numbers.
- Include the full test output in the PR description.

### Example commit message
`feat(config): validate and bound request inputs`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add tests for the config endpoint success and error paths"
labels: type:feature, area:config, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Cover the config endpoint behaviour

### Description
The config endpoint family is under-tested around its error and edge paths. This issue adds focused integration tests.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests for success, not-found, validation-failure, and idempotent-repeat paths of config.
- Assert status codes, error codes, and response shapes.
- Do not change behaviour unless a defect is found (note it).

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/config-01-endpoint`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: not-found, invalid input, duplicate, empty result.
- Include the full test output in the PR description.

### Example commit message
`test(config): cover success and error paths`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Document the config API contract and error codes"
labels: type:docs, area:config, stack:nodejs, stack:typescript, priority:low, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document the config API

### Description
The config endpoints lack a single reference for their request/response shapes and error codes, slowing integrators. This issue documents them.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/config.md` covering each config route, its params, response shape, and error codes.
- Cross-reference the handler; keep it accurate to the code.
- Include a request/response example per route.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/config-01-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify each documented route against source.
- Include the full test output in the PR description.

### Example commit message
`docs(config): document the API contract`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Extract the shared config handler validation into a reusable helper"
labels: type:refactor, area:config, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Deduplicate config validation

### Description
The config handlers repeat similar validation preambles inline. This issue extracts a shared, tested validation helper.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Extract the repeated config validation into a single helper consumed by each handler.
- Behaviour unchanged; same rejections and codes.
- No new dependencies.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/config-01-validation-helper`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: each existing rejection still fires identically.
- Include the full test output in the PR description.

### Example commit message
`refactor(config): extract shared validation helper`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add cursor pagination to the webhooks listing endpoint"
labels: type:feature, area:webhooks, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate the webhooks listing

### Description
The webhooks listing endpoint returns an unbounded array, which does not scale as data grows. This issue adds cursor-based pagination with a bounded page size.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination (bounded default + max page size) to the webhooks listing.
- Return a stable next-cursor; keep existing filters working across pages.
- Do not change the item shape.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/webhooks-01-pagination`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: empty set, exact-page boundary, over-limit clamp, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(webhooks): add cursor pagination`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Validate and bound webhooks request inputs against malformed payloads"
labels: type:feature, area:webhooks, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Harden webhooks input validation

### Description
The webhooks endpoints accept request bodies with limited validation, risking malformed or oversized inputs reaching the store. This issue adds strict input validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Reject unknown fields, wrong types, and out-of-range values on webhooks writes with a structured 400.
- Bound string lengths and numeric ranges; return a machine-readable error code.
- Cover the validation in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/webhooks-02-validation`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: missing field, wrong type, oversized string, boundary numbers.
- Include the full test output in the PR description.

### Example commit message
`feat(webhooks): validate and bound request inputs`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add tests for the webhooks endpoint success and error paths"
labels: type:feature, area:webhooks, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Cover the webhooks endpoint behaviour

### Description
The webhooks endpoint family is under-tested around its error and edge paths. This issue adds focused integration tests.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests for success, not-found, validation-failure, and idempotent-repeat paths of webhooks.
- Assert status codes, error codes, and response shapes.
- Do not change behaviour unless a defect is found (note it).

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/webhooks-01-endpoint`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: not-found, invalid input, duplicate, empty result.
- Include the full test output in the PR description.

### Example commit message
`test(webhooks): cover success and error paths`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Document the webhooks API contract and error codes"
labels: type:docs, area:webhooks, stack:nodejs, stack:typescript, priority:low, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document the webhooks API

### Description
The webhooks endpoints lack a single reference for their request/response shapes and error codes, slowing integrators. This issue documents them.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/webhooks.md` covering each webhooks route, its params, response shape, and error codes.
- Cross-reference the handler; keep it accurate to the code.
- Include a request/response example per route.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/webhooks-01-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify each documented route against source.
- Include the full test output in the PR description.

### Example commit message
`docs(webhooks): document the API contract`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Extract the shared webhooks handler validation into a reusable helper"
labels: type:refactor, area:webhooks, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Deduplicate webhooks validation

### Description
The webhooks handlers repeat similar validation preambles inline. This issue extracts a shared, tested validation helper.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Extract the repeated webhooks validation into a single helper consumed by each handler.
- Behaviour unchanged; same rejections and codes.
- No new dependencies.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/webhooks-01-validation-helper`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: each existing rejection still fires identically.
- Include the full test output in the PR description.

### Example commit message
`refactor(webhooks): extract shared validation helper`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add cursor pagination to the api-keys listing endpoint"
labels: type:feature, area:api-keys, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate the api-keys listing

### Description
The api-keys listing endpoint returns an unbounded array, which does not scale as data grows. This issue adds cursor-based pagination with a bounded page size.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination (bounded default + max page size) to the api-keys listing.
- Return a stable next-cursor; keep existing filters working across pages.
- Do not change the item shape.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/api-keys-01-pagination`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: empty set, exact-page boundary, over-limit clamp, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(api-keys): add cursor pagination`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Validate and bound api-keys request inputs against malformed payloads"
labels: type:feature, area:api-keys, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Harden api-keys input validation

### Description
The api-keys endpoints accept request bodies with limited validation, risking malformed or oversized inputs reaching the store. This issue adds strict input validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Reject unknown fields, wrong types, and out-of-range values on api-keys writes with a structured 400.
- Bound string lengths and numeric ranges; return a machine-readable error code.
- Cover the validation in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/api-keys-02-validation`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: missing field, wrong type, oversized string, boundary numbers.
- Include the full test output in the PR description.

### Example commit message
`feat(api-keys): validate and bound request inputs`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add tests for the api-keys endpoint success and error paths"
labels: type:feature, area:api-keys, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Cover the api-keys endpoint behaviour

### Description
The api-keys endpoint family is under-tested around its error and edge paths. This issue adds focused integration tests.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests for success, not-found, validation-failure, and idempotent-repeat paths of api-keys.
- Assert status codes, error codes, and response shapes.
- Do not change behaviour unless a defect is found (note it).

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/api-keys-01-endpoint`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: not-found, invalid input, duplicate, empty result.
- Include the full test output in the PR description.

### Example commit message
`test(api-keys): cover success and error paths`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Document the api-keys API contract and error codes"
labels: type:docs, area:api-keys, stack:nodejs, stack:typescript, priority:low, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document the api-keys API

### Description
The api-keys endpoints lack a single reference for their request/response shapes and error codes, slowing integrators. This issue documents them.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/api-keys.md` covering each api-keys route, its params, response shape, and error codes.
- Cross-reference the handler; keep it accurate to the code.
- Include a request/response example per route.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/api-keys-01-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify each documented route against source.
- Include the full test output in the PR description.

### Example commit message
`docs(api-keys): document the API contract`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Extract the shared api-keys handler validation into a reusable helper"
labels: type:refactor, area:api-keys, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Deduplicate api-keys validation

### Description
The api-keys handlers repeat similar validation preambles inline. This issue extracts a shared, tested validation helper.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Extract the repeated api-keys validation into a single helper consumed by each handler.
- Behaviour unchanged; same rejections and codes.
- No new dependencies.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/api-keys-01-validation-helper`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: each existing rejection still fires identically.
- Include the full test output in the PR description.

### Example commit message
`refactor(api-keys): extract shared validation helper`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add cursor pagination to the metrics listing endpoint"
labels: type:feature, area:metrics, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate the metrics listing

### Description
The metrics listing endpoint returns an unbounded array, which does not scale as data grows. This issue adds cursor-based pagination with a bounded page size.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination (bounded default + max page size) to the metrics listing.
- Return a stable next-cursor; keep existing filters working across pages.
- Do not change the item shape.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/metrics-01-pagination`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: empty set, exact-page boundary, over-limit clamp, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(metrics): add cursor pagination`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Validate and bound metrics request inputs against malformed payloads"
labels: type:feature, area:metrics, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Harden metrics input validation

### Description
The metrics endpoints accept request bodies with limited validation, risking malformed or oversized inputs reaching the store. This issue adds strict input validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Reject unknown fields, wrong types, and out-of-range values on metrics writes with a structured 400.
- Bound string lengths and numeric ranges; return a machine-readable error code.
- Cover the validation in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/metrics-02-validation`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: missing field, wrong type, oversized string, boundary numbers.
- Include the full test output in the PR description.

### Example commit message
`feat(metrics): validate and bound request inputs`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add tests for the metrics endpoint success and error paths"
labels: type:feature, area:metrics, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Cover the metrics endpoint behaviour

### Description
The metrics endpoint family is under-tested around its error and edge paths. This issue adds focused integration tests.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests for success, not-found, validation-failure, and idempotent-repeat paths of metrics.
- Assert status codes, error codes, and response shapes.
- Do not change behaviour unless a defect is found (note it).

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/metrics-01-endpoint`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: not-found, invalid input, duplicate, empty result.
- Include the full test output in the PR description.

### Example commit message
`test(metrics): cover success and error paths`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Document the metrics API contract and error codes"
labels: type:docs, area:metrics, stack:nodejs, stack:typescript, priority:low, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document the metrics API

### Description
The metrics endpoints lack a single reference for their request/response shapes and error codes, slowing integrators. This issue documents them.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/metrics.md` covering each metrics route, its params, response shape, and error codes.
- Cross-reference the handler; keep it accurate to the code.
- Include a request/response example per route.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/metrics-01-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify each documented route against source.
- Include the full test output in the PR description.

### Example commit message
`docs(metrics): document the API contract`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Extract the shared metrics handler validation into a reusable helper"
labels: type:refactor, area:metrics, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Deduplicate metrics validation

### Description
The metrics handlers repeat similar validation preambles inline. This issue extracts a shared, tested validation helper.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Extract the repeated metrics validation into a single helper consumed by each handler.
- Behaviour unchanged; same rejections and codes.
- No new dependencies.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/metrics-01-validation-helper`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: each existing rejection still fires identically.
- Include the full test output in the PR description.

### Example commit message
`refactor(metrics): extract shared validation helper`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add cursor pagination to the events listing endpoint"
labels: type:feature, area:events, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate the events listing

### Description
The events listing endpoint returns an unbounded array, which does not scale as data grows. This issue adds cursor-based pagination with a bounded page size.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination (bounded default + max page size) to the events listing.
- Return a stable next-cursor; keep existing filters working across pages.
- Do not change the item shape.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/events-01-pagination`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: empty set, exact-page boundary, over-limit clamp, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(events): add cursor pagination`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Validate and bound events request inputs against malformed payloads"
labels: type:feature, area:events, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Harden events input validation

### Description
The events endpoints accept request bodies with limited validation, risking malformed or oversized inputs reaching the store. This issue adds strict input validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Reject unknown fields, wrong types, and out-of-range values on events writes with a structured 400.
- Bound string lengths and numeric ranges; return a machine-readable error code.
- Cover the validation in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/events-02-validation`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: missing field, wrong type, oversized string, boundary numbers.
- Include the full test output in the PR description.

### Example commit message
`feat(events): validate and bound request inputs`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add tests for the events endpoint success and error paths"
labels: type:feature, area:events, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Cover the events endpoint behaviour

### Description
The events endpoint family is under-tested around its error and edge paths. This issue adds focused integration tests.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests for success, not-found, validation-failure, and idempotent-repeat paths of events.
- Assert status codes, error codes, and response shapes.
- Do not change behaviour unless a defect is found (note it).

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/events-01-endpoint`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: not-found, invalid input, duplicate, empty result.
- Include the full test output in the PR description.

### Example commit message
`test(events): cover success and error paths`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Document the events API contract and error codes"
labels: type:docs, area:events, stack:nodejs, stack:typescript, priority:low, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document the events API

### Description
The events endpoints lack a single reference for their request/response shapes and error codes, slowing integrators. This issue documents them.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/events.md` covering each events route, its params, response shape, and error codes.
- Cross-reference the handler; keep it accurate to the code.
- Include a request/response example per route.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/events-01-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify each documented route against source.
- Include the full test output in the PR description.

### Example commit message
`docs(events): document the API contract`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Extract the shared events handler validation into a reusable helper"
labels: type:refactor, area:events, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Deduplicate events validation

### Description
The events handlers repeat similar validation preambles inline. This issue extracts a shared, tested validation helper.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Extract the repeated events validation into a single helper consumed by each handler.
- Behaviour unchanged; same rejections and codes.
- No new dependencies.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/events-01-validation-helper`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: each existing rejection still fires identically.
- Include the full test output in the PR description.

### Example commit message
`refactor(events): extract shared validation helper`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add cursor pagination to the health listing endpoint"
labels: type:feature, area:health, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate the health listing

### Description
The health listing endpoint returns an unbounded array, which does not scale as data grows. This issue adds cursor-based pagination with a bounded page size.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination (bounded default + max page size) to the health listing.
- Return a stable next-cursor; keep existing filters working across pages.
- Do not change the item shape.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/health-01-pagination`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: empty set, exact-page boundary, over-limit clamp, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(health): add cursor pagination`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Validate and bound health request inputs against malformed payloads"
labels: type:feature, area:health, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Harden health input validation

### Description
The health endpoints accept request bodies with limited validation, risking malformed or oversized inputs reaching the store. This issue adds strict input validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Reject unknown fields, wrong types, and out-of-range values on health writes with a structured 400.
- Bound string lengths and numeric ranges; return a machine-readable error code.
- Cover the validation in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/health-02-validation`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: missing field, wrong type, oversized string, boundary numbers.
- Include the full test output in the PR description.

### Example commit message
`feat(health): validate and bound request inputs`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Add tests for the health endpoint success and error paths"
labels: type:feature, area:health, stack:nodejs, stack:typescript, priority:high, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Cover the health endpoint behaviour

### Description
The health endpoint family is under-tested around its error and edge paths. This issue adds focused integration tests.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests for success, not-found, validation-failure, and idempotent-repeat paths of health.
- Assert status codes, error codes, and response shapes.
- Do not change behaviour unless a defect is found (note it).

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/health-01-endpoint`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: not-found, invalid input, duplicate, empty result.
- Include the full test output in the PR description.

### Example commit message
`test(health): cover success and error paths`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Document the health API contract and error codes"
labels: type:docs, area:health, stack:nodejs, stack:typescript, priority:low, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document the health API

### Description
The health endpoints lack a single reference for their request/response shapes and error codes, slowing integrators. This issue documents them.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/health.md` covering each health route, its params, response shape, and error codes.
- Cross-reference the handler; keep it accurate to the code.
- Include a request/response example per route.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/health-01-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify each documented route against source.
- Include the full test output in the PR description.

### Example commit message
`docs(health): document the API contract`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
++++++
---
type: Feature
title: "Extract the shared health handler validation into a reusable helper"
labels: type:refactor, area:health, stack:nodejs, stack:typescript, priority:medium, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Deduplicate health validation

### Description
The health handlers repeat similar validation preambles inline. This issue extracts a shared, tested validation helper.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Extract the repeated health validation into a single helper consumed by each handler.
- Behaviour unchanged; same rejections and codes.
- No new dependencies.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/health-01-validation-helper`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: each existing rejection still fires identically.
- Include the full test output in the PR description.

### Example commit message
`refactor(health): extract shared validation helper`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
