# Rate Limiting

AgentPay enforces a sliding-window rate limit on every API request. When a
client exceeds the limit the API responds with **429 Too Many Requests** and
includes headers the client can use to back off gracefully.

---

## Defaults

| Configuration           | Default value | Notes |
|-------------------------|---------------|-------|
| `rateLimitPerWindow`    | 60            | Fixed at process start; not runtime-tunable for the limiter. |
| `rateLimitWindowMs`     | 60 000 (60 s) | Fixed at process start; not runtime-tunable for the limiter. |

The defaults mean **60 requests per rolling 60-second window**. These values
are compile-time constants consumed directly by the rate-limit middleware and
cannot be changed via the config endpoint at runtime.

---

## Bucket key (rate-limiter identity)

The rate limiter derives a stable string key for each caller so that different
tenants, API keys, and clients are counted independently.

```
api-key:{sha256-hash}     when the request carries a valid X-API-Key
ip:{trusted-client-ip}    otherwise (unauthenticated requests)
```

`{sha256-hash}` is the SHA-256 digest of the secret API key stored in the
in-memory key store. The raw secret is never exposed in headers, logs, or
bucket keys.

`{trusted-client-ip}` comes from Express' `req.ip` property, which is
influenced by the **TRUST_PROXY** setting (see below).

---

## Window semantics (sliding window)

Each bucket stores an array of millisecond Unix timestamps — one per request
hit. When a new request arrives the limiter:

1. Removes every timestamp older than `rateLimitWindowMs` from the bucket.
2. If the bucket still contains `rateLimitPerWindow` (or more) timestamps, the
   request is **rejected** with 429.
3. Otherwise the current timestamp is appended and the request is **allowed**.

This is a **true sliding window**, not a fixed/calendar window. A client cannot
burst to the limit at the boundary of a fixed interval — every request ages out
individually.

### Pruning

Stale buckets (keys with *no* timestamps inside the window) are deleted from
the in-memory map during each rate-limit evaluation to keep memory bounded.

---

## Response headers

Every response includes these headers, even on a 429:

| Header               | Always present? | Meaning                                                                 |
|----------------------|-----------------|-------------------------------------------------------------------------|
| `RateLimit-Limit`    | Yes             | Maximum requests allowed in the window (`rateLimitPerWindow`).          |
| `RateLimit-Remaining`| Yes             | How many requests the caller can still make before hitting the limit.   |
| `RateLimit-Reset`    | Yes             | Seconds until the *oldest* hit in the bucket expires and frees a slot.  |

On a **429 response only**:

| Header        | Meaning                                                                 |
|---------------|-------------------------------------------------------------------------|
| `Retry-After` | Seconds the client should wait before retrying (matches `RateLimit-Reset`). |

All numeric header values are **integers**. Seconds are always **>= 1**.

### Example response (allowed)

```http
HTTP/1.1 200 OK
RateLimit-Limit: 60
RateLimit-Remaining: 42
RateLimit-Reset: 58
```

### Example response (rate-limited)

```http
HTTP/1.1 429 Too Many Requests
RateLimit-Limit: 60
RateLimit-Remaining: 0
RateLimit-Reset: 12
Retry-After: 12
Content-Type: application/json

{
  "error": "rate_limited",
  "message": "more than 60 requests per 60s",
  "requestId": "b3f1a2c4-..."
}
```

The `message` field reflects the **live** configuration, so after a config
change the message updates accordingly (e.g. `"more than 1 requests per 2.5s"`).

---

## Client retry guidance

Clients should implement **exponential backoff with jitter** when they receive
a 429.

### Worked example

A client tries to call `GET /api/v1/services` and gets a 429:

1. **First 429** — read the `Retry-After` header (e.g. `12` seconds).
   Wait `12 + random_jitter(0..1)` seconds, then retry.
2. **Second consecutive 429** — the request pattern is exceeding the steady
   rate. Multiply the previous delay by 2: `24 + random_jitter(0..2)` seconds.
3. **Third consecutive 429** — `48 + random_jitter(0..4)` seconds.
4. Cap the backoff at a sensible maximum (e.g. 300 seconds) to avoid waiting
   forever during extended outages.

If the limit is `60 / 60 s`, a steady **1 request per second** avoids the
limit entirely. Bursting is fine as long as the overall sliding-window count
stays ≤ 60.

### Pseudocode

```
async function fetchWithRetry(url, options, maxRetries = 5) {
  let delay = 1;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const res = await fetch(url, options);
    if (res.status !== 429) return res;

    const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
    const wait = Math.min(
      Math.max(retryAfter, delay) + (Math.random() * 2),
      300
    );
    await sleep(wait * 1000);

    delay = Math.min(delay * 2, 60);
  }
  throw new Error("Max retries exceeded");
}
```

---

## TRUST_PROXY and load balancer behaviour

When AgentPay sits behind a reverse proxy (nginx, HAProxy, AWS ALB, etc.), the
client IP that Express sees is the proxy's IP — not the end user's. This would
cause *all* traffic to share a single rate-limit bucket, effectively breaking
the limiter.

Set the `TRUST_PROXY` environment variable to tell Express how many proxy hops
to trust when parsing the `X-Forwarded-For` header.

### Behaviour by value

| `TRUST_PROXY`      | Effect                                                                              |
|--------------------|-------------------------------------------------------------------------------------|
| **unset / empty**  | Express *ignores* `X-Forwarded-For`. `req.ip` is the direct TCP peer.              |
| **`"1"`**          | Express trusts 1 hop. For a single-proxy setup this makes `req.ip` the real client.|
| **`"2"`**          | Express trusts 2 hops (e.g. CDN + internal proxy).                                 |
| **non-numeric**    | Treated as `1` (trust one hop).                                                    |
| **`"0"`** or `"0"`| Equivalent to unset — disables proxy trust.                                        |
| **negative**       | Rounded up to `1`.                                                                 |

### Practical example

```
+----------+       +-------------+       +------------+
|  Client  | ----> |  nginx      | ----> |  AgentPay  |
| 1.2.3.4  |       | 10.0.0.1    |       | 10.0.0.2   |
+----------+       +-------------+       +------------+
```

Without `TRUST_PROXY`, every request appears to come from `10.0.0.1`.  With
`TRUST_PROXY=1`, Express reads `X-Forwarded-For: 1.2.3.4` and sets `req.ip` to
`1.2.3.4` — giving each client its own rate-limit bucket.

### Spoofing protection

When `TRUST_PROXY` is **unset**, spoofed `X-Forwarded-For` headers have no
effect — the limiter always uses the direct TCP peer IP.

When `TRUST_PROXY` is **set**, ensure your proxy **overwrites or strips**
incoming `X-Forwarded-For` headers from untrusted sources. Otherwise a
malicious client could inject a fake IP to bypass the limiter. Most production
proxies do this by default (e.g. `proxy_set_header X-Forwarded-For
$remote_addr` in nginx).

### Testing the trust proxy setting

The test suite verifies both scenarios:

- **Trust proxy off**: 60 requests with different spoofed `X-Forwarded-For`
  values share a single bucket (all seen as the same TCP peer) → the 61st
  request is rate-limited.
- **Trust proxy on (`TRUST_PROXY=1`)**: 61 requests with different
  `X-Forwarded-For` values get 61 *separate* buckets → all are allowed.

---

## Runtime configuration

The `GET /api/v1/config` and `PATCH /api/v1/config` endpoints expose an
in-memory configuration object for administrative visibility. However, the
rate-limit middleware reads from **module-level constants**
(`RATE_LIMIT_PER_WINDOW` and `RATE_LIMIT_WINDOW_MS`), not from the runtime
config object. Changing `rateLimitPerWindow` or `rateLimitWindowMs` via
`PATCH /api/v1/config` updates what the config endpoint reports but **does
not** affect the rate limiter's behaviour at runtime.

Read the current configuration:

```http
GET /api/v1/config

{
  "config": {
    "rateLimitPerWindow": 60,
    "rateLimitWindowMs": 60000,
    ...
  }
}
```

Reset to defaults:

```http
POST /api/v1/admin/reset
```

---

## Design notes

- **In-process only**: rate-limit buckets live in the Node.js process heap.
  They are lost on restart. For multi-process deployments place a load balancer
  with sticky sessions (or a shared store) in front of AgentPay.
- **Minimal overhead**: each request performs one `Map.get`, one
  `Array.filter` on the bucket, and one `Map.set` — all O(n) in the bucket
  size but bounded by `rateLimitPerWindow`.
- **Pruning bounds memory**: stale keys are removed during every evaluation,
  so memory grows only with active clients, not with total clients seen.
