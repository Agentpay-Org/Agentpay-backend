# Error Responses

All operational API errors use the same JSON envelope:

```json
{
  "error": "invalid_request",
  "message": "human-readable public message",
  "requestId": "trace-id"
}
```

The final Express error handler renders `AppError` instances with their public
HTTP status, code, and message. Unexpected failures are returned as
`internal_error` and include the request method and path for correlation, but do
not expose stack traces.

The supported operational error codes are:

| Status | Code                | Meaning                                      |
| ------ | ------------------- | -------------------------------------------- |
| 400    | `invalid_request`   | Client input failed validation.              |
| 404    | `not_found`         | Route or requested resource was not found.   |
| 409    | `service_disabled`  | A registered service is disabled for writes. |
| 413    | `payload_too_large` | JSON body exceeded the configured limit.     |
| 429    | `rate_limited`      | Caller exceeded the in-process rate limit.   |
| 503    | `service_paused`    | Admin pause mode is blocking writes.         |
