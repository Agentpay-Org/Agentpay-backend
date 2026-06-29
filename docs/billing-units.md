# Billing Units and Settlement Semantics

AgentPay backend quotes service usage in **stroops**, the smallest native XLM
unit on Stellar.

## Stroops

- `1 XLM = 10,000,000 stroops`.
- `1 stroop = 0.0000001 XLM`.
- `priceStroops` is the per-request price configured for a service.
- `billedStroops` is the quoted bill for an agent and service:

```text
billedStroops = requests * priceStroops
```

For example, a service priced at `250,000` stroops charges `0.025 XLM` per
request. If an agent has `8` outstanding requests for that service, the quoted
bill is `2,000,000` stroops, or `0.2 XLM`.

## Why Integer Units

Stellar amounts are precise to seven decimal places. Keeping backend prices and
bills in integer stroops avoids floating-point rounding when usage counters are
multiplied by prices. API consumers should treat `priceStroops`,
`billedStroops`, and `totalStroops` as integer ledger units and convert to XLM
only for display.

The current implementation stores counters and billing values as JavaScript
numbers. `POST /api/v1/usage` clamps request counters at
`Number.MAX_SAFE_INTEGER`. Future bigint-backed precision work should preserve
the public stroops convention while avoiding number precision limits for very
large counters and bills.

## Endpoint Semantics

### `GET /api/v1/billing/:agent/:serviceId`

Returns the current quote for one agent and service pair:

- `requests`: outstanding recorded requests.
- `priceStroops`: service price per request.
- `billedStroops`: `requests * priceStroops`.

This endpoint is read-only and does not change counters or transfer funds.

### `GET /api/v1/billing/total`

Returns `totalStroops`, the sum of all outstanding usage counters multiplied by
their service prices. This is also read-only and does not transfer funds.

### `POST /api/v1/settle`

The backend settle endpoint is an off-chain accounting operation. It:

1. Reads the outstanding counter for `{ agent, serviceId }`.
2. Multiplies that request count by the configured `priceStroops`.
3. Sets the outstanding usage counter back to `0`.
4. Returns `{ agent, serviceId, requests, priceStroops, billedStroops }`.
5. Records a `usage.settled` audit event.

It does **not** move XLM, tokens, or any other on-chain value. A successful
response means the backend drained its in-memory accumulator and quoted the
amount that should be settled elsewhere.

## Relationship to On-Chain Settlement

The backend settle endpoint is the off-chain mirror of the contract-level
`settle()` concept: it computes and clears backend usage before or alongside an
on-chain payment flow. The on-chain contract remains the place where value
movement should be enforced.

Current backend behavior is intentionally limited to metering and quoting. A
future on-chain transfer integration should submit or verify the actual Stellar
transaction separately, then connect that transaction result to the backend's
settlement audit trail.

## Consumer Guidance

- Store and compare stroop values as integers.
- Convert to XLM only for UI display or human-readable reports.
- Do not treat `POST /api/v1/settle` as proof of payment.
- Pair backend settle responses with an on-chain transaction or contract event
  before marking an invoice as paid.
