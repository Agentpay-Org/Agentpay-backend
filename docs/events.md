# Events API

## `GET /api/v1/events`

Returns the newest matching audit events by default. Accepts `since`
(unix ms, default `0`), `type` (exact event type match), `limit` (default
`100`, max = the configured event-log cap), and `cursor`. No other query
parameters are accepted.

The response includes:

- `items`: the current page in chronological order.
- `total`: the count matching `since` and `type` before pagination.
- `nextCursor`: an opaque cursor for the next older page, or `null` when there
  are no older matching events.

Clients can pass `?cursor=<nextCursor>` with the same `since`, `type`, and
`limit` parameters to page backward through older events. Cursors are tied to
the filtered event set. A malformed cursor, a cursor from another filter, or a
cursor that has fallen out of the bounded in-memory event log returns
`400 invalid_request`. A `type` that matches no known event is not an error —
it returns `200` with an empty `items` array, since the value space of event
types is open-ended (see `KNOWN_EVENT_TYPES`).

Example:

```
GET /api/v1/events?type=usage.recorded&limit=2
200 OK
{ "total": 5, "items": [ { "id": "...", "ts": 1234, "type": "usage.recorded", "payload": {} } ], "nextCursor": "MTIzNDo..." }
```

## `GET /api/v1/events/summary`

Returns per-type counts across the full in-memory event log. No query
parameters are accepted.

```
GET /api/v1/events/summary
200 OK
{ "counts": { "usage.recorded": 5, "webhook.test": 1 }, "total": 6 }
```

## Error codes

| Status | `error`          | Cause                                                   |
| ------ | ---------------- | -------------------------------------------------------- |
| 400    | `invalid_request` | Unknown query parameter, or a malformed/expired `cursor` |
