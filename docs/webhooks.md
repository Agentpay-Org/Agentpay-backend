# Webhooks

## `GET /api/v1/webhooks`

Lists registered webhooks, ordered by `createdAt` then `id`. Accepts `limit`
(default: full result set, max 1000) and `offset` (default `0`).

```json
{
  "items": [{ "id": "wh_ab12...", "url": "https://example.com/hook", "events": ["usage.recorded"], "createdAt": 1234567890 }],
  "total": 1
}
```

## `GET /api/v1/webhooks/:id`

Fetches one webhook. Same item shape as the list endpoint. `404 not_found`
when the ID is not registered or has already been deleted.

## `POST /api/v1/webhooks`

Body: `{ "url": string, "events": string[] }`.

- `url` must be an `http(s)://` URL up to 2048 characters.
- `events` must be a non-empty array of known event types (see
  `KNOWN_EVENT_TYPES` in `src/events.ts`: `usage.recorded`,
  `usage.settled`, `webhook.test`, or the wildcard `*`).

```
201 Created
{ "id": "wh_ab12...", "url": "https://example.com/hook", "events": ["usage.recorded"] }
```

## `PATCH /api/v1/webhooks/:id`

Body: `{ "url"?: string, "events"?: string[] }` — at least one field is
required. Same validation as create for whichever fields are present;
omitted fields are left unchanged.

## `POST /api/v1/webhooks/:id/test`

Simulates a delivery (no real HTTP call is made) and records a
`webhook.test` audit event.

```
200 OK
{ "id": "wh_ab12...", "deliveredAt": 1234567890, "simulated": true }
```

## `DELETE /api/v1/webhooks/:id`

Unregisters the webhook. `204 No Content` on success.

## Error codes

| Status | `error`                    | Cause                                                    |
| ------ | --------------------------- | ----------------------------------------------------------- |
| 400    | `invalid_request`           | Invalid `url`/`events`, unknown event type, or an empty PATCH body |
| 404    | `not_found`                 | No webhook with the given `id`                           |
| 429    | `store_capacity_exceeded`   | The webhook store is at its configured capacity          |
