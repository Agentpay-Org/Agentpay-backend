# Idempotency Keys

AgentPay accepts an optional `Idempotency-Key` header on billing write routes:

| Route                     | Behaviour                                                            |
| ------------------------- | -------------------------------------------------------------------- |
| `POST /api/v1/usage`      | Replays return the first usage recording response.                   |
| `POST /api/v1/usage/bulk` | Replays return the first bulk recording response.                    |
| `POST /api/v1/settle`     | Replays return the first settlement response without draining again. |

The cache key is scoped by the recognized API key when one is present, otherwise
by client IP, plus the `Idempotency-Key` value. The first JSON response is cached
with its status code and body. A replay with the same route and request body
returns that cached response and sets `Idempotency-Replayed: true`.

If the same caller reuses an idempotency key with a different route or request
body, the API returns:

```json
{
  "error": "idempotency_conflict",
  "message": "Idempotency-Key was reused with a different request",
  "requestId": "<trace id>"
}
```

Entries are stored in memory only, expire after the configured TTL, and are
evicted by insertion age when the cache reaches its maximum size. A process
restart clears the cache.
