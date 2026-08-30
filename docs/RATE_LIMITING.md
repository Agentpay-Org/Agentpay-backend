# AgentPay rate limiting

AgentPay applies an in-process sliding-window limiter to API traffic after
request identity and pause state have been established. The limiter is a
protective control for this deployment; it is not a replacement for a
distributed gateway policy when several AgentPay processes share traffic.

## Identity and isolation

An authenticated API key is represented internally by its SHA-256 digest. The
digest is prefixed with `api-key:` and is the rate-limit identity for that
tenant. The raw secret is never used as a store key. Requests without a
recognized key use the trusted Express client IP, prefixed with `ip:`.

An unrecognized `X-API-Key` is not accepted as a new identity. This matters in
development mode and in deployments where API-key enforcement is optional: an
attacker must not bypass the protection by inventing a different header value
for every request. When proxy trust is enabled, Express' configured trust
boundary determines the client IP; forwarded values are not trusted by the
limiter independently.

## Counter model

Each identity has four numeric fields:

```text
currentWindowStart, currentCount,
previousWindowStart, previousCount
```

The current and previous counter windows each have the configured window
length. A request in the current window contributes one full count. The
previous count is weighted by the fraction of its window that remains:

```text
estimated = currentCount + previousCount * (1 - elapsed / windowMs)
```

The estimate is compared with the configured limit before the current counter
is incremented. This gives a smooth boundary between windows and prevents the
classic fixed-window burst in which a caller spends a full budget immediately
before and after a boundary. Old state is rolled forward lazily and is removed
when both counter slots are empty.

The map therefore stores a constant amount of state per identity, regardless
of how many requests arrive. Rejected requests do not increment a counter.
The mutation and decision occur synchronously in the Node process, so two
same-process requests cannot interleave between the capacity check and the
increment. A multi-process deployment must put this same decision behind a
shared atomic store; that is intentionally outside this issue's scope.

## Response contract

All requests passing the limiter receive:

- `RateLimit-Limit`: configured maximum requests;
- `RateLimit-Remaining`: conservative whole-request capacity remaining;
- `RateLimit-Reset`: seconds until the active counter can release capacity.

An exceeded request receives `429 Too Many Requests`, the same three headers,
and `Retry-After`. Its JSON body has the stable shape:

```json
{
  "error": "rate_limited",
  "message": "more than 60 requests per 60s",
  "requestId": "..."
}
```

The request ID is the existing bounded `X-Request-Id` value, allowing an
operator to correlate a rejection without exposing limiter internals.

## Configuration

`rateLimitPerWindow` and `rateLimitWindowMs` are the live numeric settings.
They have safe defaults of 60 requests and 60,000 milliseconds. The existing
admin configuration validation continues to require positive bounded values.
Changing a value affects the next decision; stale buckets are normalized
against the active window and can be cleared through the existing guarded
admin reset path.

The limiter is intentionally enabled only outside `NODE_ENV=test`, preserving
deterministic route tests. Unit tests call the pure decision functions with a
controlled clock, while integration tests exercise actual HTTP headers and
429 responses under the live configuration.

## Failure and boundary behavior

Malformed or unknown API keys fall back to the trusted IP identity. They do
not create a distinct bucket. A valid key always takes precedence over the IP,
so two tenants behind one NAT address retain independent budgets.

At the exact transition into a new counter window, the previous count still
has full weight. It then decays continuously as time advances. This is why a
caller cannot send the configured maximum at the end of one window and
immediately send the same maximum at the start of the next one.

If an identity is idle for more than two counter windows, the lazy roll drops
both old slots and the next request starts cleanly. A rejected call does not
change the current count, which makes repeated retries safe from accidental
budget consumption while the caller honors `Retry-After`.

## Verification matrix

The focused test coverage includes:

| Scenario              | Guarantee                                        |
| --------------------- | ------------------------------------------------ |
| Requests below limit  | Allowed; remaining capacity is exposed           |
| Exact limit           | Next request is rejected with `429`              |
| Window boundary       | Previous pressure is retained and weighted       |
| Window expiry         | Previous pressure decays and then disappears     |
| Two valid API keys    | Independent tenant budgets                       |
| Unknown API keys      | Cannot mint identities to evade the limit        |
| Stale buckets         | Pruned without timestamp-list scans              |
| Repeated rejection    | Counter remains bounded and unchanged            |
| Forwarded IP spoofing | Ignored unless proxy trust is configured         |
| Live configuration    | Limit, window, and retry headers follow settings |

## Compatibility and rollout

The HTTP status, structured error code, header names, configuration keys, and
identity prefixes remain compatible with the previous limiter. The internal
bucket value changes from an unbounded timestamp array to a bounded counter
record. Legacy in-memory arrays are accepted once and normalized when read,
which permits a rolling process restart or test fixture migration without
making old state fatal.

Because the state is process-local, restarting a process clears its limiter.
This is the documented existing behavior and is not a durable abuse-control
boundary. For a horizontally scaled deployment, configure a shared edge
limiter or replace the store implementation with an atomic Redis/database
adapter before treating the limit as a global tenant quota.

## Rollback

The change can be rolled back by deploying the previous application version;
the in-memory state has no schema migration. During rollback, the old code can
normalize or ignore compact records only after a process restart, so operators
should restart each instance as part of a coordinated rollback. No API key or
tenant secret is persisted by this feature.
