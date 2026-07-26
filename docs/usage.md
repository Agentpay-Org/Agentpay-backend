# Usage API Contract

This document covers every route exposed by the usage router
(`src/routes/usage.ts`), its request parameters, full response shapes, and
every error code the route can return. One request/response example is included
per route.

## Identifier Rules

Both `agent` and `serviceId` fields are validated against the same rule set
before any state is touched:

| Field       | Max length | Allowed characters               |
|-------------|-----------|----------------------------------|
| `agent`     | 256        | Letters, digits, `.`, `_`, `-`  |
| `serviceId` | 128        | Letters, digits, `.`, `_`, `-`  |

The double-colon sequence `::` is rejected in both fields even when every
individual character is otherwise allowed. Empty strings are also rejected.

## Numeric Rules

`requests` must be a **positive integer** and is bounded by a per-call cap of
`1,000,000`. Accumulated `total` values are clamped at `Number.MAX_SAFE_INTEGER`
(9,007,199,254,740,991).

Stroop-denominated amounts (`priceStroops`, `billedStroops`, `totalStroops`,
`disabledStroops`) are computed with `BigInt` and serialized as **decimal
strings** so values above the safe integer range survive JSON encoding without
silent precision loss. See [`billing-units.md`](billing-units.md) for the full
billing semantics.

## Idempotency

`POST /api/v1/usage`, `POST /api/v1/usage/bulk`, `POST /api/v1/settle`, and
`POST /api/v1/settle/bulk` all accept an optional `Idempotency-Key` header. A
repeated request with the same key returns the cached response without
re-applying the mutation.

---

## Routes

### `POST /api/v1/usage`

Records a usage event for one agent/service pair and increments its outstanding
request counter.

**Request body**

```json
{ "agent": "string", "serviceId": "string", "requests": "number" }
```

**Successful response — 201**

```json
{ "agent": "agent-abc", "serviceId": "svc-llm", "total": 42 }
```

`total` is the new cumulative outstanding count for the pair (across all
previous calls, clamped at `Number.MAX_SAFE_INTEGER`).

**Error responses**

| Status | `error`                  | Condition                                                        |
|--------|--------------------------|------------------------------------------------------------------|
| 400    | `invalid_request`        | `agent` fails identifier validation                              |
| 400    | `invalid_request`        | `serviceId` fails identifier validation                          |
| 400    | `invalid_request`        | `requests` is not a positive integer or exceeds 1,000,000        |
| 409    | `service_disabled`       | The service has been administratively disabled                   |
| 429    | `store_capacity_exceeded`| `usageStoreMaxKeys` cap reached and this is a new key            |

All error bodies include `requestId`:

```json
{
  "error": "invalid_request",
  "message": "requests must be a positive integer",
  "requestId": "req_01j..."
}
```

---

### `POST /api/v1/usage/bulk`

Records usage for up to `config.bulkMaxItems` agent/service pairs in one
request (default 100, configurable up to 1,000 via `PATCH /api/v1/config`).
Invalid items are reported individually without failing valid items in the same
batch.

**Request body**

```json
{
  "items": [
    { "agent": "agent-abc", "serviceId": "svc-llm", "requests": 10 },
    { "agent": "agent-xyz", "serviceId": "svc-embed", "requests": 5 }
  ]
}
```

**Successful response — 201**

```json
{
  "results": [
    { "index": 0, "ok": true, "total": 42 },
    { "index": 1, "ok": true, "total": 5 }
  ]
}
```

Failed items carry `ok: false` and an `error` string instead of `total`:

```json
{ "index": 2, "ok": false, "error": "invalid_item" }
```

**Top-level error — 400**

Returned when the array length exceeds `config.bulkMaxItems` before any items
are processed:

```json
{
  "error": "invalid_request",
  "message": "items must be a non-empty array of up to 100 entries",
  "requestId": "req_01j..."
}
```

**Per-item `error` values**

| `error`                  | Condition                                         |
|--------------------------|---------------------------------------------------|
| `invalid_item`           | `agent`, `serviceId`, or `requests` is invalid    |
| `service_disabled`       | The service has been administratively disabled    |
| `store_capacity_exceeded`| `usageStoreMaxKeys` cap reached for a new key     |

---

### `POST /api/v1/settle`

Drains the outstanding counter for one agent/service pair and returns the
quoted bill in stroops. This is an **off-chain accounting operation** — it does
not move XLM or any on-chain value.

**Request body**

```json
{ "agent": "agent-abc", "serviceId": "svc-llm" }
```

**Successful response — 200**

```json
{
  "agent": "agent-abc",
  "serviceId": "svc-llm",
  "requests": 42,
  "priceStroops": 250000,
  "billedStroops": "10500000"
}
```

`requests` is the counter value before it was reset to zero. `billedStroops` is
`requests × priceStroops`, serialized as a decimal string. If the service has
no registered price, `priceStroops` is `0` and `billedStroops` is `"0"`.

**Error responses**

| Status | `error`           | Condition                               |
|--------|-------------------|-----------------------------------------|
| 400    | `invalid_request` | `agent` or `serviceId` fails validation |

---

### `POST /api/v1/settle/bulk`

Drains every outstanding service for a single agent in one settlement pass.
Services with no registered price are settled at zero so their counters clear.

**Request body**

```json
{ "agent": "agent-abc" }
```

**Successful response — 200**

```json
{
  "agent": "agent-abc",
  "items": [
    {
      "serviceId": "svc-llm",
      "requests": 42,
      "priceStroops": 250000,
      "billedStroops": "10500000"
    },
    {
      "serviceId": "svc-embed",
      "requests": 10,
      "priceStroops": 0,
      "billedStroops": "0"
    }
  ],
  "totalBilledStroops": "10500000"
}
```

`totalBilledStroops` is the sum across all items, serialized as a decimal
string.

**Error responses**

| Status | `error`           | Condition                        |
|--------|-------------------|----------------------------------|
| 400    | `invalid_request` | `agent` fails identifier validation |

---

### `GET /api/v1/usage/export.json`

Returns all outstanding usage entries for the request's tenant as a JSON
attachment.

**Response — 200**

```json
{
  "exportedAt": 1722000000000,
  "items": [
    { "agent": "agent-abc", "serviceId": "svc-llm", "total": 42 },
    { "agent": "agent-xyz", "serviceId": "svc-embed", "total": 5 }
  ]
}
```

`exportedAt` is a Unix timestamp in milliseconds. `items` contains every
agent/service pair with any recorded usage (including pairs settled to zero).
Returns an empty array when no usage has been recorded.

`Content-Disposition: attachment; filename=usage.json`

---

### `GET /api/v1/usage/export.csv`

Returns all outstanding usage entries as a CSV attachment. Fields are
CSV-injection-safe: values that start with `=`, `+`, `-`, `@`, `\t`, or `\r`
are prefixed with a single quote per OWASP guidance.

**Response — 200**

```
agent,serviceId,total
agent-abc,svc-llm,42
agent-xyz,svc-embed,5
```

`Content-Type: text/csv`
`Content-Disposition: attachment; filename=usage.csv`

---

### `GET /api/v1/billing/total`

Returns the aggregate outstanding bill across all agent/service pairs for the
request's tenant.

**Response — 200**

```json
{
  "totalStroops": "10500000",
  "disabledStroops": "0",
  "unpricedRequests": 10
}
```

| Field               | Description                                                                 |
|---------------------|-----------------------------------------------------------------------------|
| `totalStroops`      | Sum of `requests × priceStroops` for all priced services; decimal string.  |
| `disabledStroops`   | Portion of `totalStroops` attributable to disabled services; decimal string.|
| `unpricedRequests`  | Total outstanding requests for services with no registered price.           |

This endpoint is read-only and does not reset any counters.

---

### `GET /api/v1/billing/:agent/:serviceId`

Returns the current bill quote for one agent/service pair.

**Path parameters:** `agent`, `serviceId` — must pass identifier validation.

**Successful response — 200**

```json
{
  "agent": "agent-abc",
  "serviceId": "svc-llm",
  "requests": 42,
  "priceStroops": 250000,
  "billedStroops": "10500000"
}
```

This endpoint is read-only and does not reset any counters.

**Error responses**

| Status | `error`           | Condition                                      |
|--------|-------------------|------------------------------------------------|
| 400    | `invalid_request` | `agent` or `serviceId` fails validation        |
| 404    | `not_found`       | `serviceId` has not been registered            |

---

### `GET /api/v1/agents`

Returns a deduplicated list of agents that have any recorded usage for the
request's tenant.

**Query parameters**

| Parameter | Type    | Default | Range  | Description                     |
|-----------|---------|---------|--------|---------------------------------|
| `limit`   | integer | `100`   | 1–1000 | Maximum number of agents to return |

**Response — 200**

```json
{ "agents": ["agent-abc", "agent-xyz"] }
```

Returns an empty array when no usage has been recorded.

---

### `GET /api/v1/agents/:agent/total`

Returns the sum of outstanding request counts across all services for one
agent.

**Path parameter:** `agent` — must pass identifier validation.

**Successful response — 200**

```json
{ "agent": "agent-abc", "total": 47 }
```

`total` is `0` when the agent has no recorded usage.

**Error responses**

| Status | `error`           | Condition                          |
|--------|-------------------|------------------------------------|
| 400    | `invalid_request` | `agent` fails identifier validation |

---

### `GET /api/v1/agents/:agent/usage`

Returns a per-service breakdown of outstanding usage for one agent.

**Path parameter:** `agent` — must pass identifier validation.

**Successful response — 200**

```json
{
  "agent": "agent-abc",
  "items": [
    { "serviceId": "svc-llm", "total": 42 },
    { "serviceId": "svc-embed", "total": 5 }
  ]
}
```

`items` is empty when the agent has no recorded usage.

**Error responses**

| Status | `error`           | Condition                          |
|--------|-------------------|------------------------------------|
| 400    | `invalid_request` | `agent` fails identifier validation |

---

### `GET /api/v1/usage/:agent/:serviceId`

Returns the outstanding request count for one agent/service pair.

**Path parameters:** `agent`, `serviceId` — must pass identifier validation.

**Successful response — 200**

```json
{ "agent": "agent-abc", "serviceId": "svc-llm", "total": 42 }
```

`total` is `0` when no usage has been recorded for the pair.

**Error responses**

| Status | `error`           | Condition                                   |
|--------|-------------------|---------------------------------------------|
| 400    | `invalid_request` | `agent` or `serviceId` fails validation     |

---

### `DELETE /api/v1/usage/:agent/:serviceId`

Resets the outstanding counter for one agent/service pair to zero and records a
`usage.reset` audit event.

**Path parameters:** `agent`, `serviceId` — must pass identifier validation.

**Successful response — 200**

```json
{ "agent": "agent-abc", "serviceId": "svc-llm", "clearedTotal": 42 }
```

`clearedTotal` is the counter value before it was set to zero.

**Error responses**

| Status | `error`           | Condition                                    |
|--------|-------------------|----------------------------------------------|
| 400    | `invalid_request` | `agent` or `serviceId` fails validation      |
| 404    | `not_found`       | No usage has been recorded for the pair      |

---

## Error Response Shape

All error responses share a common envelope:

```json
{
  "error": "error_code",
  "message": "human-readable description",
  "requestId": "req_01j..."
}
```

`requestId` is derived from the `X-Request-Id` header when present, or
generated by the server. It appears in every error response and is useful for
correlating log entries with API calls.

## Related Documents

- [`billing-units.md`](billing-units.md) — stroop denomination, settlement
  semantics, and on-chain integration notes.
- [`idempotency.md`](idempotency.md) — how the `Idempotency-Key` header works
  across write endpoints.
- [`events.md`](events.md) — audit events emitted by usage and settlement
  routes (`usage.recorded`, `usage.settled`, `usage.reset`).
