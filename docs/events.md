# Event log pagination

`GET /api/v1/events` returns the newest matching audit events by default. The
response includes:

- `items`: the current page in chronological order.
- `total`: the count matching `since` and `type` before pagination.
- `nextCursor`: an opaque cursor for the next older page, or `null` when there
  are no older matching events.

Clients can pass `?cursor=<nextCursor>` with the same `since`, `type`, and
`limit` parameters to page backward through older events. Cursors are tied to
the filtered event set. A malformed cursor, a cursor from another filter, or a
cursor that has fallen out of the bounded in-memory event log returns
`400 invalid_request`.
