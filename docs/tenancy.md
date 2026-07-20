# Multi-Tenant Isolation Model

AgentPay supports multi-tenancy via API-key authentication. Each tenant receives
isolated service registrations, usage counters, and billing state, while a set
of operational surfaces remains global by design.

## Tenant ID derivation

A tenant identifier is resolved at the start of every request in
[`src/tenant.ts`](../src/tenant.ts):

```
resolveTenantId(req)
  ├── apiKeyHash present? → "api:<sha256-hex-digest>"
  └── otherwise           → "public"
```

1. **API-key recognition** — The middleware in
   [`src/middleware/index.ts`](../src/middleware/index.ts) calls `verifyApiKey`
   (from [`src/auth/apiKeys.ts`](../src/auth/apiKeys.ts)) with the inbound
   `X-API-Key` header. When a match is found, the request object is augmented
   with `apiKeyHash` — the SHA-256 hex digest of the live secret. The secret
   itself never becomes a store key, response value, or log entry.

2. **Legacy public tenant** — When no valid key is supplied, or when
   `REQUIRE_API_KEY` is not set to `"true"`, every unauthenticated request
   falls back to the shared `"public"` tenant. This preserves local-development
   and demo behaviour.

The tenant ID is then consumed by every route handler that reads or writes
tenant-scoped state (services, usage, settlement, billing quotes).

## Key encoding

All in-memory stores that support multi-tenancy use an **ASCII unit separator**
(`\x1f`, code point 0x1F) to partition keys by tenant while preserving the
historic public-tenant key shape.

The encoding logic lives in [`src/store/state.ts`](../src/store/state.ts):

### `serviceKey(tenantId, serviceId)`

```
tenantId === "public"  →  serviceId
otherwise              →  "api:<hash>\x1f<serviceId>"
```

### `parseServiceKey(key)`

```
key contains \x1f  → { tenantId: slice before \x1f, serviceId: slice after }
otherwise          → { tenantId: "public", serviceId: key }
```

### `usageKey(tenantId, agent, serviceId)`

```
tenantId === "public"  →  "<agent>::<serviceId>"
otherwise              →  "api:<hash>\x1f<agent>::<serviceId>"
```

### `parseUsageKey(key)`

```
key contains \x1f  → tenantId = slice before \x1f, remainder = slice after
otherwise          → tenantId = "public", remainder = key
remainder split on "::" → agent, serviceId
```

### Design rationale

- The public tenant uses the original key shapes (`serviceId` and
  `agent::serviceId`), so deployments that never create API keys see zero
  behavioural change.

- The `\x1f` separator cannot appear in a valid `serviceId` or `agent`
  identifier because both are validated against `[a-zA-Z0-9._-]+` in
  [`src/identifiers.ts`](../src/identifiers.ts). This prevents tenant-escaping
  injection attacks.

- Tenant IDs for API-key tenants always start with `api:`, making them visually
  distinct from any legacy public-tenant key.

## Isolated surfaces (tenant-scoped)

| Surface | Store | Key builder | Notes |
|---|---|---|---|
| Service registration | `servicesStore` | `serviceKey()` | Each tenant has its own price. |
| Service metadata | `servicesMetadata` | `serviceKey()` | `description` and `owner` are per-tenant. |
| Service disabled flag | `servicesDisabled` | `serviceKey()` | Disabling a service in one tenant does not affect others. |
| Usage counters | `usageStore` | `usageKey()` | Counters accumulate independently per tenant. |
| Per-service usage rollups | `usageStore` + filter | `parseUsageKey()` | `GET /api/v1/services/:id/usage` returns only the caller's usage. |
| Top-N agent lists | `usageStore` + filter | `parseUsageKey()` | `GET /api/v1/services/:id/agents/top` is tenant-filtered. |
| Billing quotes | `usageStore` + `servicesStore` | both | `GET /api/v1/billing/*` is implicitly tenant-scoped because it reads tenant-partitioned stores. |
| Settlement | `usageStore` + `servicesStore` | both | `POST /api/v1/settle` drains only the calling tenant's counters. |
| Bulk operations | all of the above | both | `POST /api/v1/usage/bulk` and `POST /api/v1/services/bulk` resolve the tenant once and apply all items within it. |
| Rate limiting (authenticated) | `rateBuckets` | `api-key:<hash>` | Each API key receives its own bucket. |

### Cross-tenant isolation guarantees

- Reads and mutations on another tenant's resources return `404 not_found`
  rather than `403 forbidden`, preventing callers from enumerating another
  tenant's `serviceId`s.

- Two tenants may safely register the same public `serviceId`; each receives
  independent pricing, metadata, disabled state, usage counters, and settlement
  balances.

- Deleting a service in one tenant does not affect the same `serviceId` in any
  other tenant.

- The `serviceId` returned in API responses is always the public-facing
  identifier; the internal `\x1f`-prefixed key is never exposed.

## Shared surfaces (global)

The following operational surfaces are **not** partitioned by tenant:

| Surface | Reason |
|---|---|
| **Webhook registry** (`webhookStore`) | Webhooks are stored in a flat `Map<string, WebhookRecord>`. Any authenticated caller can list, read, patch, or delete any webhook regardless of which tenant created it. |
| **Event log** | `recordEvent()` appends to a global bounded buffer. Events include the `agent` and `serviceId` but are not tagged with a tenant ID. |
| **API key store** (`apiKeyStore`) | All tenant API keys live in one global map. Listing keys returns every key's public prefix. The live secret is only returned at creation time. |
| **Admin operations** | `POST /api/v1/admin/pause`, `/unpause`, and `/reset` affect the entire process. |
| **Runtime configuration** | `PATCH /api/v1/config` sets global tunables such as `bulkMaxItems` and `rateLimitPerWindow` for all tenants. |
| **Pause state** | `pauseState.paused` gates all write traffic regardless of tenant. |
| **Health / readiness** | `GET /health` and `GET /api/v1/health/ready` are process-wide. |
| **Metrics** | Prometheus metrics and the JSON stats endpoint aggregate across all tenants. `lifetimeRequests` and `settlementCounters` are global accumulators. |
| **Rate limiting (unauthenticated)** | When no API key is present, rate-limit buckets fall back to the client IP. Multiple callers behind the same NAT can drain the same bucket. |

### Known un-isolated surface: webhook registry

The webhook registry is the most significant isolation gap. It was intentionally
left global because:

- Webhook delivery is not yet implemented; the registry stores subscriptions
  and a synthetic `POST /api/v1/webhooks/:id/test` fires a no-op audit event.
- There is no tenant context in the delivery pipeline.

**Until the webhook registry is scoped to tenants**, do not rely on it for
cross-tenant security. A future iteration should either:

- add a tenant prefix to `webhookStore` keys (matching the `serviceKey`
  pattern), or
- introduce a separate delivery-worker layer that dispatches webhooks with
  tenant context.

## The legacy public tenant rule

The `"public"` tenant is the **default fallback** when no authenticated API key
is present. Its behaviour is the compatibility baseline: every deployment that
does not create API keys operates entirely within this shared space.

Key rules:

1. **No `\x1f` in store keys** — `serviceKey("public", "my-svc")` returns
   `"my-svc"`, not `"public\x1fmy-svc"`. This keeps all existing store keys
   unchanged.

2. **Shared space** — All unauthenticated callers share one set of services,
   usage counters, and settlement balances. This is appropriate for local
   development and single-tenant demos but not for production multi-tenancy.

3. **Separation from API-key tenants** — A service registered under the public
   tenant is invisible to an API-key tenant and vice versa, even when both use
   the same `serviceId`.

## Idempotency keys and tenants

Idempotency keys are **not** prefixed with the tenant ID. If two tenants submit
the same idempotency key (e.g. a short sequence number), the second request is
silently absorbed. Production deployments should use UUIDs or other
tenant-unique values as idempotency keys.

## Performance considerations

Several tenant-filtered list endpoints iterate over **every key** in the
in-memory store and filter by tenant in the handler:

- `GET /api/v1/services` — scans all `servicesStore` keys.
- `GET /api/v1/services/:id/usage` — scans all `usageStore` keys.
- `GET /api/v1/services/:id/agents` and `/agents/top` — scans all `usageStore` keys.

With many tenants and a large total key count, these O(N) scans may cause
event-loop lag. A future durable-store adapter should push the tenant filter
into the storage layer (e.g. a prefix scan or `WHERE tenant_id = ?`).

## Trust model

The current API is designed for development and demo environments:

- **API keys are tenant-level credentials.** They provide namespace isolation
  but not per-agent authorization within a tenant.
- **No tenant-level admin hierarchy.** Any caller with a valid API key can
  register services, record usage, and settle bills within that tenant.
- **`ADMIN_API_KEY` is a global super-user credential** that bypasses tenant
  scoping entirely.

Production hardening should add a durable store adapter, tenant-scoped
webhooks, tenant-scoped idempotency, and per-tenant rate-limit and store-size
caps.

## Summary diagram

```
                              X-API-Key header
                                    │
                              ┌─────▼──────┐
                              │ verifyApiKey│  (src/auth/apiKeys.ts)
                              └─────┬──────┘
                                    │
                          recognized? │ not recognized
                         ┌────────────┴────────────┐
                         │                         │
                    apiKeyHash                  (empty)
                         │                         │
                         ▼                         ▼
              resolveTenantId(req)       resolveTenantId(req)
              → "api:<sha256>"           → "public"
                         │                         │
                         └─────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │    tenant-scoped stores       │
                    │                               │
                    │  servicesStore   ◄── \x1f ──► │
                    │  servicesMetadata ◄── \x1f ──► │
                    │  servicesDisabled ◄── \x1f ──► │
                    │  usageStore      ◄── \x1f ──► │
                    │  rateBuckets     ◄── hash ──► │
                    │                               │
                    └───────────────────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │    global (un-isolated)        │
                    │                               │
                    │  webhookStore                 │
                    │  apiKeyStore                  │
                    │  eventLog                     │
                    │  config, pauseState           │
                    │  settlementCounters           │
                    │  lifetimeRequests             │
                    │  health/readiness             │
                    └───────────────────────────────┘
```

## References

- [`src/tenant.ts`](../src/tenant.ts) — `resolveTenantId()` and `DEFAULT_TENANT_ID`.
- [`src/store/state.ts`](../src/store/state.ts) — store maps, `serviceKey()`, `usageKey()`, `parseServiceKey()`, `parseUsageKey()`, and `TENANT_KEY_SEPARATOR`.
- [`src/auth/apiKeys.ts`](../src/auth/apiKeys.ts) — `hashApiKey()`, `verifyApiKey()`, and timing-safe comparison.
- [`src/middleware/index.ts`](../src/middleware/index.ts) — `apiKeyAuthMiddleware` that populates `apiKeyHash` on the request.
- [`src/routes/services.ts`](../src/routes/services.ts) — tenant-scoped service CRUD and rollups.
- [`src/routes/usage.ts`](../src/routes/usage.ts) — tenant-scoped usage recording and settlement.
- [`src/routes/webhooks.ts`](../src/routes/webhooks.ts) — **un-isolated** webhook registry.
- [`README.md`](../README.md) — multi-tenancy quickstart section.
