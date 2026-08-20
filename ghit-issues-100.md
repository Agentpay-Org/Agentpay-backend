---
type: Feature
title: "Add idempotency-key support to the auth write endpoints"
labels: type:feature, area:auth, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent auth

### Description
Retried auth writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on auth writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/auth-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(auth): add idempotency keys`

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
title: "Add cursor pagination to the auth list endpoint"
labels: type:feature, area:auth, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate auth

### Description
auth list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the auth list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/auth-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(auth): add cursor pagination`

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
title: "Add success and error-path tests for auth"
labels: type:test, area:auth, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test auth

### Description
auth lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering auth success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/auth-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(auth): cover success and error paths`

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
title: "Validate and bound auth request inputs"
labels: type:refactor, area:auth, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate auth

### Description
auth inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate auth request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/auth-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(auth): validate and bound inputs`

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
title: "Document the auth API contract and errors"
labels: type:docs, area:auth, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document auth

### Description
auth's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/auth-api.md` describing the auth endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/auth-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(auth): document API contract`

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
title: "Add idempotency-key support to the api-keys write endpoints"
labels: type:feature, area:api-keys, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent api-keys

### Description
Retried api-keys writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on api-keys writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/api-keys-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(api-keys): add idempotency keys`

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
title: "Add cursor pagination to the api-keys list endpoint"
labels: type:feature, area:api-keys, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate api-keys

### Description
api-keys list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the api-keys list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/api-keys-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
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
title: "Add success and error-path tests for api-keys"
labels: type:test, area:api-keys, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test api-keys

### Description
api-keys lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering api-keys success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/api-keys-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
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
title: "Validate and bound api-keys request inputs"
labels: type:refactor, area:api-keys, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate api-keys

### Description
api-keys inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate api-keys request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/api-keys-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(api-keys): validate and bound inputs`

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
title: "Document the api-keys API contract and errors"
labels: type:docs, area:api-keys, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document api-keys

### Description
api-keys's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/api-keys-api.md` describing the api-keys endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/api-keys-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(api-keys): document API contract`

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
title: "Add idempotency-key support to the webhooks write endpoints"
labels: type:feature, area:webhooks, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent webhooks

### Description
Retried webhooks writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on webhooks writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/webhooks-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(webhooks): add idempotency keys`

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
title: "Add cursor pagination to the webhooks list endpoint"
labels: type:feature, area:webhooks, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate webhooks

### Description
webhooks list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the webhooks list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/webhooks-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
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
title: "Add success and error-path tests for webhooks"
labels: type:test, area:webhooks, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test webhooks

### Description
webhooks lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering webhooks success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/webhooks-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
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
title: "Validate and bound webhooks request inputs"
labels: type:refactor, area:webhooks, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate webhooks

### Description
webhooks inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate webhooks request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/webhooks-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(webhooks): validate and bound inputs`

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
title: "Document the webhooks API contract and errors"
labels: type:docs, area:webhooks, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document webhooks

### Description
webhooks's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/webhooks-api.md` describing the webhooks endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/webhooks-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(webhooks): document API contract`

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
title: "Add idempotency-key support to the events write endpoints"
labels: type:feature, area:events, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent events

### Description
Retried events writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on events writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/events-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(events): add idempotency keys`

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
title: "Add cursor pagination to the events list endpoint"
labels: type:feature, area:events, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate events

### Description
events list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the events list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/events-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
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
title: "Add success and error-path tests for events"
labels: type:test, area:events, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test events

### Description
events lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering events success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/events-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
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
title: "Validate and bound events request inputs"
labels: type:refactor, area:events, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate events

### Description
events inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate events request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/events-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(events): validate and bound inputs`

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
title: "Document the events API contract and errors"
labels: type:docs, area:events, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document events

### Description
events's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/events-api.md` describing the events endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/events-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(events): document API contract`

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
title: "Add idempotency-key support to the metrics write endpoints"
labels: type:feature, area:metrics, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent metrics

### Description
Retried metrics writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on metrics writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/metrics-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(metrics): add idempotency keys`

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
title: "Add cursor pagination to the metrics list endpoint"
labels: type:feature, area:metrics, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate metrics

### Description
metrics list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the metrics list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/metrics-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
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
title: "Add success and error-path tests for metrics"
labels: type:test, area:metrics, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test metrics

### Description
metrics lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering metrics success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/metrics-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
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
title: "Validate and bound metrics request inputs"
labels: type:refactor, area:metrics, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate metrics

### Description
metrics inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate metrics request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/metrics-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(metrics): validate and bound inputs`

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
title: "Document the metrics API contract and errors"
labels: type:docs, area:metrics, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document metrics

### Description
metrics's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/metrics-api.md` describing the metrics endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/metrics-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(metrics): document API contract`

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
title: "Add idempotency-key support to the health write endpoints"
labels: type:feature, area:health, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent health

### Description
Retried health writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on health writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/health-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(health): add idempotency keys`

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
title: "Add cursor pagination to the health list endpoint"
labels: type:feature, area:health, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate health

### Description
health list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the health list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/health-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
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
title: "Add success and error-path tests for health"
labels: type:test, area:health, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test health

### Description
health lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering health success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/health-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
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
title: "Validate and bound health request inputs"
labels: type:refactor, area:health, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate health

### Description
health inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate health request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/health-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(health): validate and bound inputs`

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
title: "Document the health API contract and errors"
labels: type:docs, area:health, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document health

### Description
health's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/health-api.md` describing the health endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/health-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(health): document API contract`

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
title: "Add idempotency-key support to the payments write endpoints"
labels: type:feature, area:payments, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent payments

### Description
Retried payments writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on payments writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/payments-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(payments): add idempotency keys`

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
title: "Add cursor pagination to the payments list endpoint"
labels: type:feature, area:payments, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate payments

### Description
payments list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the payments list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/payments-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(payments): add cursor pagination`

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
title: "Add success and error-path tests for payments"
labels: type:test, area:payments, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test payments

### Description
payments lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering payments success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/payments-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(payments): cover success and error paths`

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
title: "Validate and bound payments request inputs"
labels: type:refactor, area:payments, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate payments

### Description
payments inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate payments request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/payments-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(payments): validate and bound inputs`

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
title: "Document the payments API contract and errors"
labels: type:docs, area:payments, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document payments

### Description
payments's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/payments-api.md` describing the payments endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/payments-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(payments): document API contract`

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
title: "Add idempotency-key support to the payouts write endpoints"
labels: type:feature, area:payouts, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent payouts

### Description
Retried payouts writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on payouts writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/payouts-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(payouts): add idempotency keys`

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
title: "Add cursor pagination to the payouts list endpoint"
labels: type:feature, area:payouts, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate payouts

### Description
payouts list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the payouts list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/payouts-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(payouts): add cursor pagination`

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
title: "Add success and error-path tests for payouts"
labels: type:test, area:payouts, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test payouts

### Description
payouts lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering payouts success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/payouts-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(payouts): cover success and error paths`

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
title: "Validate and bound payouts request inputs"
labels: type:refactor, area:payouts, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate payouts

### Description
payouts inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate payouts request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/payouts-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(payouts): validate and bound inputs`

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
title: "Document the payouts API contract and errors"
labels: type:docs, area:payouts, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document payouts

### Description
payouts's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/payouts-api.md` describing the payouts endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/payouts-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(payouts): document API contract`

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
title: "Add idempotency-key support to the refunds write endpoints"
labels: type:feature, area:refunds, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent refunds

### Description
Retried refunds writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on refunds writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/refunds-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(refunds): add idempotency keys`

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
title: "Add cursor pagination to the refunds list endpoint"
labels: type:feature, area:refunds, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate refunds

### Description
refunds list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the refunds list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/refunds-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(refunds): add cursor pagination`

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
title: "Add success and error-path tests for refunds"
labels: type:test, area:refunds, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test refunds

### Description
refunds lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering refunds success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/refunds-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(refunds): cover success and error paths`

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
title: "Validate and bound refunds request inputs"
labels: type:refactor, area:refunds, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate refunds

### Description
refunds inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate refunds request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/refunds-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(refunds): validate and bound inputs`

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
title: "Document the refunds API contract and errors"
labels: type:docs, area:refunds, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document refunds

### Description
refunds's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/refunds-api.md` describing the refunds endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/refunds-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(refunds): document API contract`

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
title: "Add idempotency-key support to the ledger write endpoints"
labels: type:feature, area:ledger, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent ledger

### Description
Retried ledger writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on ledger writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/ledger-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(ledger): add idempotency keys`

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
title: "Add cursor pagination to the ledger list endpoint"
labels: type:feature, area:ledger, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate ledger

### Description
ledger list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the ledger list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/ledger-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(ledger): add cursor pagination`

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
title: "Add success and error-path tests for ledger"
labels: type:test, area:ledger, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test ledger

### Description
ledger lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering ledger success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/ledger-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(ledger): cover success and error paths`

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
title: "Validate and bound ledger request inputs"
labels: type:refactor, area:ledger, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate ledger

### Description
ledger inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate ledger request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/ledger-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(ledger): validate and bound inputs`

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
title: "Document the ledger API contract and errors"
labels: type:docs, area:ledger, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document ledger

### Description
ledger's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/ledger-api.md` describing the ledger endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/ledger-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(ledger): document API contract`

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
title: "Add idempotency-key support to the accounts write endpoints"
labels: type:feature, area:accounts, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent accounts

### Description
Retried accounts writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on accounts writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/accounts-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(accounts): add idempotency keys`

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
title: "Add cursor pagination to the accounts list endpoint"
labels: type:feature, area:accounts, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate accounts

### Description
accounts list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the accounts list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/accounts-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(accounts): add cursor pagination`

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
title: "Add success and error-path tests for accounts"
labels: type:test, area:accounts, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test accounts

### Description
accounts lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering accounts success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/accounts-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(accounts): cover success and error paths`

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
title: "Validate and bound accounts request inputs"
labels: type:refactor, area:accounts, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate accounts

### Description
accounts inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate accounts request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/accounts-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(accounts): validate and bound inputs`

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
title: "Document the accounts API contract and errors"
labels: type:docs, area:accounts, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document accounts

### Description
accounts's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/accounts-api.md` describing the accounts endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/accounts-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(accounts): document API contract`

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
title: "Add idempotency-key support to the transactions write endpoints"
labels: type:feature, area:transactions, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent transactions

### Description
Retried transactions writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on transactions writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/transactions-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(transactions): add idempotency keys`

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
title: "Add cursor pagination to the transactions list endpoint"
labels: type:feature, area:transactions, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate transactions

### Description
transactions list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the transactions list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/transactions-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(transactions): add cursor pagination`

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
title: "Add success and error-path tests for transactions"
labels: type:test, area:transactions, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test transactions

### Description
transactions lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering transactions success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/transactions-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(transactions): cover success and error paths`

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
title: "Validate and bound transactions request inputs"
labels: type:refactor, area:transactions, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate transactions

### Description
transactions inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate transactions request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/transactions-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(transactions): validate and bound inputs`

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
title: "Document the transactions API contract and errors"
labels: type:docs, area:transactions, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document transactions

### Description
transactions's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/transactions-api.md` describing the transactions endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/transactions-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(transactions): document API contract`

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
title: "Add idempotency-key support to the invoices write endpoints"
labels: type:feature, area:invoices, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent invoices

### Description
Retried invoices writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on invoices writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/invoices-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(invoices): add idempotency keys`

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
title: "Add cursor pagination to the invoices list endpoint"
labels: type:feature, area:invoices, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate invoices

### Description
invoices list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the invoices list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/invoices-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(invoices): add cursor pagination`

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
title: "Add success and error-path tests for invoices"
labels: type:test, area:invoices, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test invoices

### Description
invoices lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering invoices success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/invoices-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(invoices): cover success and error paths`

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
title: "Validate and bound invoices request inputs"
labels: type:refactor, area:invoices, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate invoices

### Description
invoices inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate invoices request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/invoices-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(invoices): validate and bound inputs`

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
title: "Document the invoices API contract and errors"
labels: type:docs, area:invoices, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document invoices

### Description
invoices's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/invoices-api.md` describing the invoices endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/invoices-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(invoices): document API contract`

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
title: "Add idempotency-key support to the subscriptions write endpoints"
labels: type:feature, area:subscriptions, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent subscriptions

### Description
Retried subscriptions writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on subscriptions writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/subscriptions-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(subscriptions): add idempotency keys`

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
title: "Add cursor pagination to the subscriptions list endpoint"
labels: type:feature, area:subscriptions, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate subscriptions

### Description
subscriptions list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the subscriptions list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/subscriptions-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(subscriptions): add cursor pagination`

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
title: "Add success and error-path tests for subscriptions"
labels: type:test, area:subscriptions, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test subscriptions

### Description
subscriptions lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering subscriptions success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/subscriptions-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(subscriptions): cover success and error paths`

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
title: "Validate and bound subscriptions request inputs"
labels: type:refactor, area:subscriptions, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate subscriptions

### Description
subscriptions inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate subscriptions request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/subscriptions-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(subscriptions): validate and bound inputs`

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
title: "Document the subscriptions API contract and errors"
labels: type:docs, area:subscriptions, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document subscriptions

### Description
subscriptions's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/subscriptions-api.md` describing the subscriptions endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/subscriptions-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(subscriptions): document API contract`

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
title: "Add idempotency-key support to the notifications write endpoints"
labels: type:feature, area:notifications, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent notifications

### Description
Retried notifications writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on notifications writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/notifications-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(notifications): add idempotency keys`

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
title: "Add cursor pagination to the notifications list endpoint"
labels: type:feature, area:notifications, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate notifications

### Description
notifications list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the notifications list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/notifications-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(notifications): add cursor pagination`

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
title: "Add success and error-path tests for notifications"
labels: type:test, area:notifications, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test notifications

### Description
notifications lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering notifications success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/notifications-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(notifications): cover success and error paths`

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
title: "Validate and bound notifications request inputs"
labels: type:refactor, area:notifications, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate notifications

### Description
notifications inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate notifications request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/notifications-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(notifications): validate and bound inputs`

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
title: "Document the notifications API contract and errors"
labels: type:docs, area:notifications, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document notifications

### Description
notifications's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/notifications-api.md` describing the notifications endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/notifications-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(notifications): document API contract`

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
title: "Add idempotency-key support to the audit write endpoints"
labels: type:feature, area:audit, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent audit

### Description
Retried audit writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on audit writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/audit-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(audit): add idempotency keys`

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
title: "Add cursor pagination to the audit list endpoint"
labels: type:feature, area:audit, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate audit

### Description
audit list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the audit list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/audit-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(audit): add cursor pagination`

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
title: "Add success and error-path tests for audit"
labels: type:test, area:audit, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test audit

### Description
audit lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering audit success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/audit-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(audit): cover success and error paths`

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
title: "Validate and bound audit request inputs"
labels: type:refactor, area:audit, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate audit

### Description
audit inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate audit request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/audit-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(audit): validate and bound inputs`

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
title: "Document the audit API contract and errors"
labels: type:docs, area:audit, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document audit

### Description
audit's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/audit-api.md` describing the audit endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/audit-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(audit): document API contract`

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
title: "Add idempotency-key support to the ratelimit write endpoints"
labels: type:feature, area:ratelimit, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent ratelimit

### Description
Retried ratelimit writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on ratelimit writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/ratelimit-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(ratelimit): add idempotency keys`

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
title: "Add cursor pagination to the ratelimit list endpoint"
labels: type:feature, area:ratelimit, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate ratelimit

### Description
ratelimit list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the ratelimit list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/ratelimit-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(ratelimit): add cursor pagination`

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
title: "Add success and error-path tests for ratelimit"
labels: type:test, area:ratelimit, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test ratelimit

### Description
ratelimit lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering ratelimit success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/ratelimit-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(ratelimit): cover success and error paths`

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
title: "Validate and bound ratelimit request inputs"
labels: type:refactor, area:ratelimit, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate ratelimit

### Description
ratelimit inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate ratelimit request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/ratelimit-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(ratelimit): validate and bound inputs`

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
title: "Document the ratelimit API contract and errors"
labels: type:docs, area:ratelimit, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document ratelimit

### Description
ratelimit's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/ratelimit-api.md` describing the ratelimit endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/ratelimit-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(ratelimit): document API contract`

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
title: "Add idempotency-key support to the config write endpoints"
labels: type:feature, area:config, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent config

### Description
Retried config writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on config writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/config-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(config): add idempotency keys`

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
title: "Add cursor pagination to the config list endpoint"
labels: type:feature, area:config, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate config

### Description
config list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the config list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/config-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
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
title: "Add success and error-path tests for config"
labels: type:test, area:config, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test config

### Description
config lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering config success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/config-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
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
title: "Validate and bound config request inputs"
labels: type:refactor, area:config, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate config

### Description
config inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate config request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/config-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(config): validate and bound inputs`

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
title: "Document the config API contract and errors"
labels: type:docs, area:config, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document config

### Description
config's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/config-api.md` describing the config endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/config-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(config): document API contract`

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
title: "Add idempotency-key support to the jobs write endpoints"
labels: type:feature, area:jobs, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent jobs

### Description
Retried jobs writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on jobs writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/jobs-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(jobs): add idempotency keys`

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
title: "Add cursor pagination to the jobs list endpoint"
labels: type:feature, area:jobs, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate jobs

### Description
jobs list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the jobs list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/jobs-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(jobs): add cursor pagination`

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
title: "Add success and error-path tests for jobs"
labels: type:test, area:jobs, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test jobs

### Description
jobs lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering jobs success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/jobs-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(jobs): cover success and error paths`

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
title: "Validate and bound jobs request inputs"
labels: type:refactor, area:jobs, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate jobs

### Description
jobs inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate jobs request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/jobs-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(jobs): validate and bound inputs`

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
title: "Document the jobs API contract and errors"
labels: type:docs, area:jobs, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document jobs

### Description
jobs's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/jobs-api.md` describing the jobs endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/jobs-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(jobs): document API contract`

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
title: "Add idempotency-key support to the reconciliation write endpoints"
labels: type:feature, area:reconciliation, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Idempotent reconciliation

### Description
Retried reconciliation writes can double-apply. This issue adds idempotency-key support.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Accept an Idempotency-Key on reconciliation writes and return the stored result on replay within a TTL.
- Reject a reused key with a different body (409).
- Cover first-write, replay, and conflict in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/reconciliation-91-idem`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first write, replay same, replay different body 409.
- Include the full test output in the PR description.

### Example commit message
`feat(reconciliation): add idempotency keys`

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
title: "Add cursor pagination to the reconciliation list endpoint"
labels: type:feature, area:reconciliation, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Paginate reconciliation

### Description
reconciliation list returns everything at once. This issue adds cursor pagination.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add opaque-cursor pagination to the reconciliation list endpoint with a bounded page size.
- Return a stable nextCursor; reject invalid cursors.
- Cover first page, next page, end, and invalid cursor in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b feature/reconciliation-92-cursor`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: first page, next, end, invalid cursor.
- Include the full test output in the PR description.

### Example commit message
`feat(reconciliation): add cursor pagination`

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
title: "Add success and error-path tests for reconciliation"
labels: type:test, area:reconciliation, stack:nodejs, stack:typescript, priority:high, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Test reconciliation

### Description
reconciliation lacks full success/error coverage. This issue adds it.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add tests covering reconciliation success plus the main error paths (validation, not-found, conflict).
- Deterministic; no real network.
- Note any defect uncovered.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b test/reconciliation-91-paths`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: success, validation, not-found, conflict.
- Include the full test output in the PR description.

### Example commit message
`test(reconciliation): cover success and error paths`

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
title: "Validate and bound reconciliation request inputs"
labels: type:refactor, area:reconciliation, stack:nodejs, stack:typescript, priority:medium, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Validate reconciliation

### Description
reconciliation inputs aren't fully bounded. This issue adds declarative validation.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Validate reconciliation request inputs against a schema with sane bounds; reject invalid with structured 400s.
- Behaviour otherwise unchanged.
- Cover valid and invalid in tests.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b refactor/reconciliation-91-validate`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: valid passes, oversized/malformed rejected.
- Include the full test output in the PR description.

### Example commit message
`refactor(reconciliation): validate and bound inputs`

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
title: "Document the reconciliation API contract and errors"
labels: type:docs, area:reconciliation, stack:nodejs, stack:typescript, priority:low, Stellar Wave, MAYBE REWARDED, GRANTFOX OSS, OFFICIAL CAMPAIGN, Official Campaign | FWC26
assignees: ''
---

## Document reconciliation

### Description
reconciliation's API contract isn't documented. This issue adds a reference.

### Requirements and context
- **Repository scope:** Agentpay-Org/Agentpay-backend only.
- Add `docs/reconciliation-api.md` describing the reconciliation endpoints, params, responses, and error codes.
- Keep accurate to the routes.
- Link from the docs index.

### Suggested execution
- Fork the repo and create a branch
- `git checkout -b docs/reconciliation-91-api`
- Implement changes
  - **Write code in:** the relevant module.
  - **Write comprehensive tests in:** cover the new behaviour and edge cases.
- Test and commit

### Test and commit
- Run `npm run lint`, `npm test`, and `npm run build`.
- Cover edge cases: n/a — verify against routes.
- Include the full test output in the PR description.

### Example commit message
`docs(reconciliation): document API contract`

### Guidelines
- **Minimum 95 percent test coverage** for impacted modules.
- Clear, reviewer-focused documentation.
- **Timeframe: 96 hours.**

### Community & contribution rewards
- 💬 **Join the AgentPay community on Discord:** https://discord.gg/eXvRKkgcv
- ⭐ This is a **GrantFox OSS / Official Campaign** task and **may be rewarded**. When your PR is merged you'll be prompted to rate the project — a **5-star rating** is much appreciated.
