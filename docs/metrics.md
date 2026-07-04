# Metrics

`GET /api/v1/metrics` exposes Prometheus text format (`text/plain; version=0.0.4`).

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
