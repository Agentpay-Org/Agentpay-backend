# Audit Event Taxonomy

AgentPay records process-local audit events with `recordEvent(type, payload)`.
The current event log powers `GET /api/v1/events`,
`GET /api/v1/events/summary`, and the planned webhook delivery surface.

## Common Envelope

Every event returned by `GET /api/v1/events` has the same envelope:

| Field     | Type   | Description |
| --------- | ------ | ----------- |
| `id`      | string | UUID generated when the event is appended. |
| `ts`      | number | Unix epoch timestamp in milliseconds from `Date.now()`. |
| `type`    | string | Stable dot-separated event type. |
| `payload` | object | Event-specific payload documented below. |

Example envelope:

```json
{
  "id": "45ceae9a-7f74-4f88-a08c-6d5f43cb7a8f",
  "ts": 1782230400000,
  "type": "usage.recorded",
  "payload": {
    "agent": "agent-alpha",
    "serviceId": "svc-search",
    "requests": 3,
    "total": 8
  }
}
```

## Retention, Ordering, And Query Semantics

- Events are kept in memory only; they do not survive process restarts.
- `EVENT_LOG_CAP` is `10000`. When the log grows beyond that cap, the oldest
  event is evicted.
- Events are appended in creation order.
- `GET /api/v1/events` filters by `since` with inclusive `e.ts >= since`
  semantics, filters `type` by exact match, and returns the most recent
  `limit` matching events in chronological order.
- `GET /api/v1/events/summary` counts only the events still present in the
  bounded in-memory log.

## Event Types

### `usage.recorded`

Emitted by:

- `POST /api/v1/usage`
- `POST /api/v1/usage/bulk`, once for each valid item

Single usage payload:

| Field       | Type   | Description |
| ----------- | ------ | ----------- |
| `agent`     | string | Agent identifier from the request body. |
| `serviceId` | string | Service identifier from the request body. |
| `requests`  | number | Positive integer request count recorded by this call. |
| `total`     | number | New accumulated usage total for the agent/service pair. |

Example:

```json
{
  "agent": "agent-alpha",
  "serviceId": "svc-search",
  "requests": 3,
  "total": 8
}
```

Bulk usage payload:

| Field       | Type    | Description |
| ----------- | ------- | ----------- |
| `agent`     | string  | Agent identifier from the valid bulk item. |
| `serviceId` | string  | Service identifier from the valid bulk item. |
| `requests`  | number  | Positive integer request count from the valid bulk item. |
| `total`     | number  | New accumulated usage total for the agent/service pair. |
| `bulk`      | boolean | Always `true` for events emitted by `POST /api/v1/usage/bulk`. |

Example:

```json
{
  "agent": "agent-alpha",
  "serviceId": "svc-search",
  "requests": 2,
  "total": 10,
  "bulk": true
}
```

Invalid bulk items do not emit events.

### `usage.settled`

Emitted by:

- `POST /api/v1/settle`

Payload:

| Field           | Type   | Description |
| --------------- | ------ | ----------- |
| `agent`         | string | Agent identifier from the request body. |
| `serviceId`     | string | Service identifier from the request body. |
| `requests`      | number | Outstanding usage count before the settle operation drains it. |
| `billedStroops` | number | `requests * priceStroops` for the service at settle time. |

Example:

```json
{
  "agent": "agent-alpha",
  "serviceId": "svc-search",
  "requests": 10,
  "billedStroops": 250
}
```

### `webhook.test`

Emitted by:

- `POST /api/v1/webhooks/:id/test`

Payload:

| Field | Type   | Description |
| ----- | ------ | ----------- |
| `id`  | string | Registered webhook identifier from the route parameter. |
| `url` | string | Registered webhook URL at the time of the synthetic test. |

Example:

```json
{
  "id": "wh_13b2fd90b4a64a70",
  "url": "https://example.test/hook"
}
```

The current test route records the event and returns a simulated delivery
response. It does not perform an outbound webhook delivery.

## Endpoint Mapping

| Endpoint | Events emitted |
| -------- | -------------- |
| `POST /api/v1/usage` | One `usage.recorded` event for a valid request. |
| `POST /api/v1/usage/bulk` | One `usage.recorded` event with `bulk: true` for each valid item. |
| `POST /api/v1/settle` | One `usage.settled` event. |
| `POST /api/v1/webhooks/:id/test` | One `webhook.test` event for a registered webhook. |

## Security And Privacy Notes

- Event payloads must not include API-key secrets, credentials, bearer tokens,
  private keys, or payment secrets.
- Current webhook events include the registered webhook URL because that is the
  object being tested; consumers should still treat all event payload fields as
  untrusted input.
- Future event payloads should prefer stable identifiers and numeric state over
  raw request bodies.

## Naming Convention For Future Events

Use lower-case dot-separated names in the form:

```text
<domain>.<past-tense-action>
```

Examples:

- `usage.recorded`
- `usage.settled`
- `webhook.test`

Keep event names stable once released. Prefer additive payload changes, and use
explicit fields such as `bulk: true` for variants when they preserve the same
event meaning.
