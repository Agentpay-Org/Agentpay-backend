# Metrics

## `GET /api/v1/metrics`

No query parameters are accepted. Exposes Prometheus text format
(`text/plain; version=0.0.4`).

The endpoint keeps the existing operational gauges:

- `agentpay_services_total`
- `agentpay_api_keys_total`
- `agentpay_usage_requests_total`
- `agentpay_paused`

It also records HTTP traffic metrics:

- `agentpay_http_requests_total{method,route,status}` counts completed
  responses.
- `agentpay_http_request_duration_seconds{method,route,status}` is a histogram
  with bucket, sum, and count samples.
- `agentpay_http_errors_total{type}` counts requests that reached the terminal
  Express error handler.

`route` uses the matched Express route pattern, such as
`/api/v1/usage/:agent/:serviceId`, rather than raw request paths. Unmatched
routes and parser failures use `route="unmatched"` so agent IDs, service IDs,
and other user-controlled path segments do not create high-cardinality metric
labels.

## `GET /api/v1/stats`

Aggregate JSON snapshot, plus a cursor-paginated `servicesBreakdown` of every
registered service's price and outstanding (unsettled) request count.
Accepts `limit` (default `50`, max `500`) and `cursor`; no other query
parameters are accepted.

```json
{
  "totalServices": 3,
  "totalApiKeys": 0,
  "totalWebhooks": 0,
  "usageKeys": 1,
  "totalRequests": 5,
  "lifetimeRequests": 5,
  "uniqueAgents": 1,
  "settledStroopsTotal": "0",
  "settlementsTotal": 0,
  "paused": false,
  "servicesBreakdown": [
    { "tenantId": "default", "serviceId": "svc-a", "priceStroops": 10, "requestsOutstanding": 5 }
  ],
  "servicesBreakdownTotal": 3,
  "nextServicesBreakdownCursor": "ZGVmYXVsdDo6c3ZjLWE"
}
```

Pass `?cursor=<nextServicesBreakdownCursor>` to page through the remaining
services. A malformed or expired cursor returns `400 invalid_request`.

## Error codes

| Status | `error`          | Cause                                                          |
| ------ | ---------------- | ----------------------------------------------------------------- |
| 400    | `invalid_request` | Unknown query parameter, or a malformed/expired `cursor` on `/api/v1/stats` |
