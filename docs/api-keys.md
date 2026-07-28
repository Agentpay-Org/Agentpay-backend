# API Keys

## `GET /api/v1/api-keys`

Lists API keys (never the live secret, only `prefix`/`label`/`createdAt`),
ordered by `createdAt` then `prefix`. Accepts `limit` (default: full result
set, max 1000) plus either `offset` (default `0`) or `cursor` — no other
query parameters are accepted.

```json
{
  "items": [{ "prefix": "apk_ab12cd34", "label": "integration key", "createdAt": 1234567890 }],
  "total": 1,
  "nextCursor": null
}
```

Pass `?cursor=<nextCursor>` instead of `offset` to page forward without
recomputing an offset; both styles report the same `nextCursor`, so
existing `offset`-based clients can switch to cursor paging at any time. A
malformed or expired cursor returns `400 invalid_request`.

## `POST /api/v1/api-keys`

Body: `{ "label": string }` — 1-64 characters, must not be blank/whitespace
only, no other fields accepted.

```
201 Created
{ "key": "apk_<32 hex chars>", "label": "integration key" }
```

The full `key` is returned only once, at creation. Only its 8-character
`prefix` is stored and returned by subsequent list calls.

## `DELETE /api/v1/api-keys/:prefix`

Revokes the key with the given `prefix`. `prefix` must be 1-64 alphanumeric
or underscore characters; anything else is rejected before the store is
even searched.

## Error codes

| Status | `error`            | Cause                                                       |
| ------ | ------------------- | -------------------------------------------------------------- |
| 400    | `invalid_request`   | Unexpected body/query field, blank label, malformed `prefix`, or a malformed/expired `cursor` |
| 404    | `not_found`         | No API key with the given `prefix`                          |
| 429    | `store_capacity_exceeded` | The API key store is at its configured capacity        |
