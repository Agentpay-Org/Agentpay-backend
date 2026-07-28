# Health

Three routes report process health at increasing depth. All three reject
any query parameter outside the documented allow-list with
`400 invalid_request`.

## `GET /health`

Shallow liveness probe. No query parameters are accepted.

Response `200`:

```json
{ "status": "ok", "service": "agentpay-backend" }
```

## `GET /api/v1/health/ready`

Readiness probe for load balancers. Returns `503` once the process has
started draining (see `markShuttingDown`). No query parameters are accepted.

Response `200` (ready):

```json
{ "ready": true }
```

Response `503` (draining):

```json
{ "ready": false }
```

## `GET /api/v1/health/deep`

Process diagnostics plus a cursor-paginated list of subsystem checks.
Accepts `limit` (default `10`, max `50`) and `cursor` (opaque, from a
previous response's `nextChecksCursor`).

Response `200`:

```json
{
  "status": "ok",
  "uptimeSeconds": 1234,
  "memory": { "rssMb": 64, "heapUsedMb": 32 },
  "pid": 4821,
  "node": "v24.11.1",
  "checks": [
    { "name": "eventLog", "status": "ok", "detail": { "size": 12, "cap": 10000 } },
    { "name": "usageStore", "status": "ok", "detail": { "size": 3, "cap": 100000 } }
  ],
  "checksTotal": 6,
  "nextChecksCursor": "dXNhZ2VTdG9yZQ"
}
```

`status` is `"paused"` when the backend is admin-paused, otherwise `"ok"`.
Each entry in `checks` reports `"warn"` when the underlying store has
reached its configured capacity, `"ok"` otherwise. Pass
`?cursor=<nextChecksCursor>` to page through the remaining checks; a
malformed or unrecognized cursor returns `400 invalid_request`.

### Error codes

| Status | `error`            | Cause                                               |
| ------ | ------------------- | ---------------------------------------------------- |
| 400    | `invalid_request`   | Unknown query parameter, or a malformed/expired `cursor` |
| 503    | n/a (`ready:false`) | `/api/v1/health/ready` while the process is draining |
