# Agents API Contract

This document covers the agents routes exposed by `src/routes/usage.ts`.
All routes are tenant-aware and operate on the current tenant's usage data.

## Identifier Rules

`agent` must be a safe identifier: 1–256 characters, limited to letters,
digits, `.`, `_`, and `-`. The `::` sequence is rejected.

Invalid identifiers return `400 invalid_request` with:

```json
{
  "error": "invalid_request",
  "message": "agent and serviceId must be safe identifiers",
  "requestId": "req_01j..."
}
```

## Routes

### `GET /api/v1/agents`

Returns the distinct agents with recorded usage for the current tenant.
`limit` is optional, defaults to `100`, and is capped at `1000`.

**Successful response — 200**

```json
{ "agents": ["agent-a", "agent-b"] }
```

### `GET /api/v1/agents/:agent/total`

Returns the total outstanding usage for one agent across all services.
Agents with no usage return `0`.

**Successful response — 200**

```json
{ "agent": "agent-a", "total": 42 }
```

### `GET /api/v1/agents/:agent/usage`

Returns the per-service outstanding usage for one agent.
Agents with no usage return an empty `items` array.

**Successful response — 200**

```json
{
  "agent": "agent-a",
  "items": [
    { "serviceId": "svc-a", "total": 21 },
    { "serviceId": "svc-b", "total": 21 }
  ]
}
```

## Error Codes

| Status | `error`           | Cause |
| ------ | ----------------- | ----- |
| 400    | `invalid_request` | `agent` fails identifier validation |
