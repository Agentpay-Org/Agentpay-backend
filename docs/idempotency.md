# Idempotency Keys

`POST /api/v1/usage`, `POST /api/v1/usage/bulk`, and `POST /api/v1/settle`
honor an optional `Idempotency-Key` header.

When the first request for a caller/key pair completes, the backend stores the
JSON response status and body in memory. A retry with the same caller, key, and
body returns that stored response and includes:

```http
Idempotency-Replayed: true
```

If the same caller reuses a key with a different body, the backend returns:

```json
{
  "error": "idempotency_conflict",
  "message": "Idempotency-Key was already used with a different body",
  "requestId": "..."
}
```

Entries are namespaced by authenticated API key when one is recognized, falling
back to the request IP. The cache is in-memory, capped at 10,000 entries, and
expires entries after 10 minutes. It is replay protection for process-local
network retries, not durable storage.
