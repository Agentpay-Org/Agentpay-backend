# Payment error contract

The charge API exposes one stable error contract for failures raised by the
payment handlers:

```json
{
  "code": "invalid_request",
  "message": "amount must be a positive safe integer",
  "requestId": "01J..."
}
```

The legacy `error` property is an alias of `code` for clients that consumed
the original gateway responses. New clients should use `code`; the code is the
machine-readable compatibility boundary and the message is safe display or
diagnostic text. Every payment error has a request id for support correlation.

## Status mapping

| Code                   | HTTP status | Meaning                                                     |
| ---------------------- | ----------: | ----------------------------------------------------------- |
| `invalid_request`      |         400 | The charge body or idempotency key is invalid.              |
| `not_found`            |         404 | The requested charge does not exist for the current tenant. |
| `idempotency_conflict` |         409 | A key was reused with a different request fingerprint.      |
| `request_in_progress`  |         409 | An identical keyed request is still being processed.        |
| `internal_error`       |         500 | An unexpected failure occurred while processing a payment.  |

The mapping lives in `src/middleware/paymentErrorHandler.ts`. Handlers create
`PaymentDomainError` values and pass them to that middleware; they do not
choose response status codes or build error JSON themselves. This keeps status
selection centralized and prevents an internal exception, stack, database
path, or idempotency fingerprint from reaching a caller.

## Request correlation

The normal application middleware assigns `req.id` and echoes it as
`X-Request-Id`. The payment envelope copies that same value to `requestId`.
When the router is embedded without the application middleware, it accepts a
safe incoming `X-Request-Id`; the isolated router test fallback is
`unknown-request` so the field is never omitted.

## Examples

Invalid charge:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{"code":"invalid_request","message":"amount must be a positive safe integer","requestId":"req-123"}
```

Unknown charge:

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{"code":"not_found","message":"charge ch_missing is not registered","requestId":"req-123"}
```

Unexpected failure:

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{"code":"internal_error","message":"Unexpected payment processing error","requestId":"req-123"}
```

The detailed exception is logged server-side with the request id. Consumers
must not attempt to infer a retry policy from the message; use the HTTP status
and stable code, and apply the idempotency-key contract for safe retries.
