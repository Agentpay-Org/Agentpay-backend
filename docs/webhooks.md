# Webhooks

AgentPay can deliver audit events to registered HTTP subscribers.

## Registration

Create a webhook with a target URL and one or more event types:

```http
POST /api/v1/webhooks
Content-Type: application/json

{
  "url": "https://example.com/agentpay-webhook",
  "events": ["usage.recorded", "usage.settled"]
}
```

Use `"*"` to subscribe to every event type.

The creation response includes a `secret` once. Store it securely; list and
update responses never echo it.

## Payload

AgentPay sends JSON:

```json
{
  "id": "event-id",
  "type": "usage.recorded",
  "ts": 1782310000000,
  "payload": {
    "agent": "agent-a",
    "serviceId": "service-a",
    "requests": 3,
    "total": 10
  }
}
```

## Headers

Every delivery includes:

- `X-AgentPay-Delivery`: unique delivery id.
- `X-AgentPay-Event`: event type.
- `X-AgentPay-Signature`: `sha256=<hex hmac>`.

The HMAC uses SHA-256 over the exact request body with the webhook secret.
Receivers should compare the expected and supplied signature with a constant-time
comparison.

## Retry and Dead Letters

AgentPay retries 5xx and network failures up to three attempts. A 2xx response
marks the delivery successful. A 4xx response is treated as permanent and is not
retried.

When delivery fails permanently, AgentPay increments the webhook `deadLetters`
count. The count is visible in webhook list, patch, and test responses.

## SSRF Protection

Webhook targets must be `http` or `https`. Private, loopback, and link-local
targets are rejected by default, including hostnames that resolve to private
addresses. Set `ALLOW_PRIVATE_WEBHOOKS=true` only in controlled local/test
environments that intentionally need private targets.
