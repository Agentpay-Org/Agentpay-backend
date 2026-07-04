# Idempotency Keys

`POST /api/v1/usage`, `POST /api/v1/usage/bulk`, and `POST /api/v1/settle`
honor the `Idempotency-Key` header so clients can safely retry billing writes
after a timeout or dropped connection.

## Replay Behavior

The backend stores the first JSON response for each `(caller, key)` pair. The
caller namespace is the recognized `X-API-Key` when present, otherwise the
client IP address. API keys are hashed before they are used in the in-memory
idempotency cache key.

When the same caller retries the same route with the same request body and the
same `Idempotency-Key`, the backend returns the original status and body, and
adds:

```text
Idempotency-Replayed: true
```

The success response shapes are unchanged. For example, a replayed
`POST /api/v1/usage` response still looks like:

```json
{
  "agent": "agent-alpha",
  "serviceId": "embedding-v1",
  "total": 3
}
```

## Conflicts

If the same caller reuses an `Idempotency-Key` with a different request body or
route before the cached entry expires, the backend rejects the request:

```json
{
  "error": "idempotency_conflict",
  "message": "Idempotency-Key was already used with a different request body or route",
  "requestId": "..."
}
```

The response status is `409 Conflict`.

## Cache Limits

The idempotency cache is process-local and in-memory. It resets on restart. Two
optional environment variables control its size and age:

| Variable                        |  Default | Description                        |
| ------------------------------- | -------: | ---------------------------------- |
| `IDEMPOTENCY_CACHE_TTL_MS`      | `600000` | Entry lifetime in milliseconds     |
| `IDEMPOTENCY_CACHE_MAX_ENTRIES` |   `1000` | Maximum cached idempotency entries |

Expired entries are pruned before handling a keyed request. When the cache is
over capacity, the oldest entries are evicted first.
