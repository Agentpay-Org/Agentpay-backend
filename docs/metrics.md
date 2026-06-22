# Metrics

`GET /api/v1/metrics` exposes Prometheus text format with the existing service,
API-key, usage, and pause gauges plus HTTP traffic metrics.

## Gauges

| Metric                          | Meaning                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `agentpay_services_total`       | Registered services in memory.                            |
| `agentpay_api_keys_total`       | API keys in memory.                                       |
| `agentpay_usage_requests_total` | Outstanding, unsettled usage requests.                    |
| `agentpay_paused`               | `1` when state-changing writes are paused, otherwise `0`. |

## HTTP counters and histograms

| Metric                                   | Type      | Labels                                       | Meaning                                        |
| ---------------------------------------- | --------- | -------------------------------------------- | ---------------------------------------------- |
| `agentpay_http_requests_total`           | counter   | `method`, `route`, `status`                  | Completed HTTP responses.                      |
| `agentpay_http_request_duration_seconds` | histogram | `method`, `route`, `status`, `le` on buckets | Wall-clock request duration.                   |
| `agentpay_http_errors_total`             | counter   | none                                         | Requests that reached the final error handler. |

Route labels use Express route patterns such as
`/api/v1/usage/:agent/:serviceId`. Unknown routes and parser failures use
`unmatched`; raw agent IDs, service IDs, webhook IDs, and other path values are
not emitted as labels.
