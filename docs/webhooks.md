# Webhooks

## `GET /api/v1/webhooks`

Lists registered webhooks, ordered by `createdAt` then `id`. Accepts `limit`
(default: full result set, max 1000) and `offset` (default `0`).

```json
{
  "items": [{ "id": "wh_ab12...", "url": "https://example.com/hook", "events": ["usage.recorded"], "createdAt": 1234567890 }],
  "total": 1
}
```

## `GET /api/v1/webhooks/:id`

Fetches one webhook. Same item shape as the list endpoint. `404 not_found`
when the ID is not registered or has already been deleted.

## `POST /api/v1/webhooks`

Body: `{ "url": string, "events": string[] }`.

- `url` must be an `http(s)://` URL up to 2048 characters.
- `events` must be a non-empty array of known event types (see
  `KNOWN_EVENT_TYPES` in `src/events.ts`: `usage.recorded`,
  `usage.settled`, `webhook.test`, or the wildcard `*`).

```
201 Created
{ "id": "wh_ab12...", "url": "https://example.com/hook", "events": ["usage.recorded"], "secret": "..." }
```

The `secret` is returned only when the webhook is created. Store it in the
subscriber's secret manager; it is not returned by `GET`, `PATCH`, or the
webhook list endpoint. The delivery service keeps the signing secret in a
separate in-memory store so normal webhook metadata responses cannot leak it.

## Signed delivery service

Application code sends an event through `deliverEventToWebhooks` in
`src/services/webhookDelivery.ts`. The helper selects subscribers whose event
list contains the event type or `*`, then starts one independent delivery for
each subscriber. A failed subscriber does not prevent other subscribers from
receiving the same event.

Each request contains the JSON event body and these headers:

| Header | Meaning |
| ------ | ------- |
| `X-Delivery-Id` | Stable idempotency key for this event/subscriber delivery |
| `X-Signature-Timestamp` | Unix timestamp included in the signed message |
| `X-Signature` | Lowercase hexadecimal HMAC-SHA256 digest |

The signed message is `timestamp + "." + rawBody`. Subscribers must calculate
the digest over the exact bytes received, using their webhook secret, and
compare it with a constant-time comparison. Parsing and re-serializing JSON
before verification can change whitespace or property order, so verification
must happen before any normalization.

The body includes `deliveryId`, `eventType`, `payload`, and `timestamp`. The
timestamp is both visible to the consumer and covered by the signature. A
consumer should reject timestamps outside its allowed clock-skew window and
should remember delivery IDs that it has already processed. The sender also
remembers successful IDs, so replaying a completed delivery is idempotent from
the sender's perspective.

## Retry policy

The delivery helper treats HTTP 408, 425, 429, and every 5xx response as
transient. Network and transport exceptions are transient as well. Other 4xx
responses are considered permanent and are attempted once. The default is
four total attempts, with a 250 ms exponential base and a 10 second maximum
delay. A small bounded jitter is added to avoid synchronized retry waves.

Callers may provide `maxAttempts`, `backoffBaseMs`, `backoffMaxMs`, `sleep`,
`now`, and `random` through `DeliveryOptions`. Attempt and delay inputs are
bounded inside the service: attempts are limited to ten and each delay value
is limited to ten seconds. Invalid values fall back to safe defaults. Injected
clock, random, sleep, and transport functions make retry behavior deterministic
in tests without waiting in real time.

The retry loop signs every attempt with its current timestamp. This means a
consumer can enforce freshness without accepting an old signature copied from
a previous attempt. The delivery ID remains stable across attempts so
consumers can deduplicate them.

## Payload and error policy

Signed bodies are capped at 256 KiB, measured as UTF-8 bytes rather than
JavaScript string length. Oversized bodies fail before the transport is called.
The public `WebhookDeliveryError` class exposes stable codes such as
`INVALID_SECRET` and `PAYLOAD_TOO_LARGE`; callers should branch on `code`, not
on an error message intended for humans.

The transport's response body is deliberately ignored. A remote response can
contain sensitive implementation details, and only its status is needed to
make the retry decision. When a delivery is exhausted, the DLQ stores the
delivery ID, webhook ID, event type, original payload, attempt count, failure
reason, and creation/update timestamps. Payloads are cloned when placed in
the DLQ so later caller mutations cannot rewrite the audit record.

## Dead-letter operations

The in-process DLQ is intentionally bounded by process lifetime, matching the
rest of this development backend. It is not a replacement for a durable
external queue. Operators can inspect it with `listDeadLetters()` or retrieve
one record with `getDeadLetter(deliveryId)`. `replayDeadLetter(deliveryId,
webhook, options)` reuses the original delivery ID and payload. A successful
replay removes the DLQ record and marks the ID complete; a failed replay
updates the same record rather than creating a duplicate.

A missing DLQ ID returns a structured `DeliveryResult` with
`lastError: "dead-letter delivery not found"`. This keeps administrative
callers from needing to catch an exception for an expected lookup miss.

## Operational guidance

1. Keep the generated secret in a secret manager and rotate by creating a new
   webhook subscription when possible.
2. Verify the signature before deserializing untrusted fields into application
   objects.
3. Enforce a timestamp freshness window and retain processed delivery IDs at
   the subscriber.
4. Alert on DLQ growth and inspect the `lastError` field for endpoint health,
   rate limiting, or payload contract failures.
5. Replay only after the subscriber is healthy; replaying a permanent 4xx will
   otherwise keep updating the same DLQ record.
6. Treat a 2xx response as acknowledgement of receipt, not proof that the
   subscriber completed its business transaction.

The service functions are intentionally transport-agnostic. Production code
can replace the default `fetch` transport with a client that adds proxy,
timeouts, tracing, or egress policy while retaining the signing, retry, and
DLQ invariants.

## `PATCH /api/v1/webhooks/:id`

Body: `{ "url"?: string, "events"?: string[] }` — at least one field is
required. Same validation as create for whichever fields are present;
omitted fields are left unchanged.

## `POST /api/v1/webhooks/:id/test`

Simulates a delivery (no real HTTP call is made) and records a
`webhook.test` audit event.

```
200 OK
{ "id": "wh_ab12...", "deliveredAt": 1234567890, "simulated": true }
```

## `DELETE /api/v1/webhooks/:id`

Unregisters the webhook. `204 No Content` on success.

## Error codes

| Status | `error`                    | Cause                                                    |
| ------ | --------------------------- | ----------------------------------------------------------- |
| 400    | `invalid_request`           | Invalid `url`/`events`, unknown event type, or an empty PATCH body |
| 404    | `not_found`                 | No webhook with the given `id`                           |
| 429    | `store_capacity_exceeded`   | The webhook store is at its configured capacity          |
