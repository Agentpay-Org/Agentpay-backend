# Service-list cursor pagination

`GET /api/v1/services` supports opaque cursor pagination while retaining the
existing `services` response property and all existing filters.

## Request and response

```http
GET /api/v1/services?limit=25&prefix=embed-
```

The response keeps the service list in `services` and adds pagination metadata:

```json
{
  "services": [{ "serviceId": "embed-chat", "priceStroops": 12, "disabled": false }],
  "total": 1,
  "limit": 25,
  "nextCursor": null
}
```

When `nextCursor` is not null, send it back unchanged with the same filters:

```http
GET /api/v1/services?limit=25&prefix=embed-&cursor=<opaque-value>
```

The default and maximum page size are both 100. A positive oversized value is
clamped to 100, while zero and negative values clamp to the minimum of one.
Invalid or omitted values use the default. This gives callers a bounded scan
even when they bypass the HTTP route and call the helper directly.

## Stable ordering and concurrent writes

The route materializes only the current tenant and filter scope, then sorts
the result by `serviceId` using a locale-independent lexical comparison. A
service id is unique within a tenant, so it is the stable total-order key and
does not need a second tie-breaker.

The cursor stores the last service id plus the tenant and all active filters.
The next page starts strictly after that id. A service inserted before the
cursor is intentionally not added to an in-progress scan; a service inserted
after the cursor is eligible on the next page. Existing services therefore
cannot be skipped or repeated because of insertion-order changes.

## Cursor safety and errors

The cursor is a signed base64url payload. Clients must treat it as opaque and
must not decode it or use it as an offset. It includes an issued-at timestamp
and expires after 24 hours by default. Operators can tune this with
`SERVICE_CURSOR_TTL_MS` and should set `SERVICE_CURSOR_SECRET` in deployments;
`CURSOR_SECRET` is accepted as a shared fallback.

Malformed, tampered, expired, tenant-mismatched, filter-mismatched, or deleted
service cursors return HTTP 400:

```json
{
  "error": "invalid_request",
  "code": "invalid_cursor",
  "message": "cursor is expired",
  "requestId": "request-correlation-id"
}
```

The response contains no internal offsets, key material, stacks, or exception
details. At the end of a scan, `nextCursor` is explicitly `null`.

ETag support remains available. The ETag covers the complete paginated response
including the cursor metadata, so a conditional request is safe for a specific
page and filter set.
