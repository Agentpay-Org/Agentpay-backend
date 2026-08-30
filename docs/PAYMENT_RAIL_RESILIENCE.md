# Payment-rail resilience

This service talks to systems that can fail independently of the AgentPay API:
acquirers, payout providers, fraud services, and ledger gateways. A request
must fail predictably when one of those systems is unavailable. The
`src/paymentRail.ts` module provides the common policy boundary for those
calls.

## Policy at a glance

| Concern                   | Contract                                                      |
| ------------------------- | ------------------------------------------------------------- |
| Retry scope               | Only operations explicitly marked `idempotent: true`          |
| Retryable failures        | 408, 425, 429, 5xx, and transient network codes               |
| Default attempts          | Three total attempts                                          |
| Backoff                   | Exponential, capped at 2 seconds, with 20% bounded jitter     |
| Circuit scope             | One breaker per dependency name                               |
| Default opening threshold | Three consecutive failed calls                                |
| Default probe delay       | Ten seconds                                                   |
| Terminal code             | `upstream_unavailable` for transient exhaustion/open circuits |
| Permanent response        | `upstream_rejected`, with no retry                            |

The defaults are conservative. A caller can override each limit for a known
provider, but should document why a different value is safe.

## Calling a rail

Transport adapters keep their SDK or HTTP client in the operation function:

```ts
import { executePaymentRail } from "./paymentRail.js";

const authorization = await executePaymentRail(
  () => acquirer.authorize({ amount, idempotencyKey }),
  {
    dependency: "acquirer-primary",
    idempotent: true,
  }
);
```

The dependency name is operationally significant. Use a stable name for one
failure domain, such as `acquirer-primary` or `payout-provider-eu`. Do not use
the request ID, merchant ID, or URL with a query string. A high-cardinality
name would create many independent breakers and defeat protection.

## Idempotency is a safety decision

Retries can duplicate a charge, payout, refund, or capture when the provider
accepted a request but the response was lost. Mark an operation idempotent only
when one of these is true:

1. The provider guarantees idempotency for the supplied key.
2. The operation is a read-only lookup.
3. The adapter has an equivalent durable deduplication record.

For an unknown write outcome, return the typed error and reconcile using the
provider's idempotency key. Never turn on retries merely because a request
uses `POST`. `idempotent: false` is the safe default for side effects.

## What gets retried

The default classifier retries status 408 (timeout), 425 (too early), 429
(rate limited), and all 5xx statuses. It also retries the transport errors
`ECONNRESET`, `ECONNREFUSED`, `ETIMEDOUT`, `EAI_AGAIN`, and
`UND_ERR_CONNECT_TIMEOUT`.

The following are treated as permanent unless an adapter supplies a narrower
or more appropriate `isRetryable` classifier:

- authentication and configuration errors;
- validation failures and card declines;
- conflict responses where repeating the request can change meaning;
- unknown errors without a transient status or code.

An adapter may attach `retryable: true` to a provider error when the provider's
documentation identifies another transient condition. Keep that classification
close to the adapter, and test it with a permanent error as well.

## Circuit lifecycle

Each dependency has a breaker with three states:

```text
closed --threshold failures--> open --cooldown elapsed--> half_open
   ^                                  |                       |
   |                                  +--request rejected     |
   +------------------- successful probe <-------------------+
```

While `closed`, calls proceed and consecutive failures are counted. Once the
threshold is reached, new calls fail immediately with `circuit_open`; this
prevents a failing provider from consuming all request workers. After the
cooldown, one half-open probe is permitted. A successful probe closes and
resets the breaker. A failed probe opens it again.

The registry is intentionally per process. In a multi-instance deployment,
each instance protects its own workers. If a provider requires a fleet-wide
breaker, coordinate that decision outside this helper rather than putting
request-specific state in a process-global metric.

## Errors and API mapping

`PaymentRailError` exposes:

- `code`: stable machine-readable category;
- `dependency`: the isolated provider name;
- `attempts`: attempts made by this execution;
- `retryable`: whether a caller may safely retry at a higher layer;
- `cause`: the original SDK or transport error for internal logging.

HTTP handlers should map `upstream_unavailable` and `circuit_open` to the
service's established dependency-failure response. Do not serialize `cause` to
clients: SDK errors can contain credentials, request headers, or provider
payloads. Queue consumers should preserve the stable code and idempotency key
when scheduling reconciliation.

## Metrics and logs

Pass `onMetric` to emit low-cardinality events. Recommended counters are:

- `payment_rail_attempts_total{dependency}`;
- `payment_rail_retries_total{dependency}`;
- `payment_rail_failures_total{dependency,code}`;
- `payment_rail_circuit_open_total{dependency}`;
- `payment_rail_circuit_rejections_total{dependency}`.

Do not label metrics with charge IDs, customer IDs, URLs, or raw provider
messages. The logger hook can include the dependency, attempt, delay, and
breaker state. Log the original error only through the configured structured
logger, which is responsible for redaction.

## Configuration checklist

Before merging an adapter, confirm:

- [ ] its dependency name identifies one provider failure domain;
- [ ] writes have a provider idempotency key or remain non-retryable;
- [ ] retry classification covers timeout, rate limit, and server responses;
- [ ] permanent declines are not retried;
- [ ] attempts and delays have explicit upper bounds;
- [ ] jitter is enabled for concurrent workers;
- [ ] `upstream_unavailable` is mapped to a documented API/queue outcome;
- [ ] metrics are low-cardinality and contain no payment data;
- [ ] a circuit-open event is visible to operators;
- [ ] reconciliation handles an accepted-but-undelivered response.

The tests in `src/paymentRail.test.ts` exercise success after retry, the
non-idempotent guard, permanent failures, opening and probing, dependency
isolation, and the default classifier. Keep those cases as a contract when
transport adapters are added.
