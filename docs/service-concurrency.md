# Service update concurrency

AgentPay service configuration is shared by request handlers, operators, and
automation. A price, disabled flag, or metadata update that reads an old
service and writes later can otherwise erase a newer change. Service reads now
carry a monotonic `version`, and every update accepts the version observed by
the client.

## API contract

A service detail or list item contains:

```json
{
  "serviceId": "invoice-risk",
  "priceStroops": 25,
  "disabled": false,
  "version": 4
}
```

An update includes `expectedVersion`:

```http
PATCH /api/v1/services/invoice-risk/price
Content-Type: application/json

{"priceStroops":30,"expectedVersion":4}
```

The same guard applies to price, disabled-state, metadata, and existing-service
upsert mutations. A newly registered service starts at version `1`. A
successful update advances the version once, even when multiple fields are
changed in one operation.

## Validation

`expectedVersion` is a JSON positive safe integer. The boundary rejects missing,
blank, string, zero, negative, fractional, unsafe, and non-numeric values as
`400 invalid_request`. Numeric strings are not coerced because accepting both
representations makes clients accidentally pass form-encoded values and hides
schema mistakes.

The response includes the request id when available. It does not include the
service's internal map key, tenant separator, stack trace, or request body.

## Conflict response

When the stored version differs, the update returns `409 version_conflict`:

```json
{
  "error": "version_conflict",
  "message": "service was modified; re-read and retry with the current version",
  "expectedVersion": 4,
  "currentVersion": 5,
  "retryable": true,
  "requestId": "request-123"
}
```

The current version is the only state needed to decide whether to re-read. The
caller must fetch the full service representation before retrying; changing
only the version can apply a stale business decision to a new state.

## Storage boundary

The current implementation uses process-local maps, but `servicesVersions` is a
separate map keyed with the same tenant-aware key as `servicesStore`. The route
performs its check and state mutation synchronously, so there is no await point
between the check and the write in the in-memory implementation.

When a durable store is introduced, preserve this predicate at the store
layer:

```sql
UPDATE services
SET price_stroops = $1,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE tenant_id = $2
  AND service_id = $3
  AND version = $4
RETURNING service_id, price_stroops, version;
```

Do not implement a durable version check as `SELECT`, application comparison,
then unconditional `UPDATE`; two workers can pass the comparison. A zero-row
conditional update is the conflict signal.

## Every update path

The following paths use the same expected-version requirement:

| Path | Mutation | Response version |
| --- | --- | --- |
| `POST /api/v1/services` for an existing id | price and optional inline metadata | subsequent reads |
| `PUT /api/v1/services/:id/metadata` | description and owner | yes |
| `PATCH /api/v1/services/:id/price` | price | yes |
| `PATCH /api/v1/services/:id/disabled` | disabled state | yes |

The `POST /disable` and `POST /enable` aliases use the same version guard and
return the next version. They remain state-idempotent in their resulting flag,
but a stale caller still receives 409 rather than silently claiming it updated
newer state. Deletion remains a separate lifecycle operation and does not
pretend that a deleted resource can be retried as an update.

Reads include the version in both `/services/:serviceId` and filtered list
responses. Metadata reads include it too, so a client can edit metadata after a
metadata fetch without an additional detail request.

## Retry algorithm

Clients should use this sequence:

1. Fetch the service.
2. Validate the intended change against the returned state.
3. Send the update with the returned version.
4. Replace the local object with the successful response or a fresh read.
5. On `409 version_conflict`, fetch again.
6. Re-evaluate the change against the new service state.
7. Retry with the new version and bounded backoff.
8. Stop after a small attempt limit and surface contention.

The shared helper documents three attempts with delays of 25ms and 50ms by
default. It calculates a delay but never sleeps or retries automatically. This
keeps the business operation visible to callers and prevents replaying stale
intent behind a generic middleware retry.

## Idempotency and versions

An idempotency key answers whether the same request was already processed. A
version answers whether the representation being changed is still current.
They solve different problems and can be used together:

- idempotency prevents duplicate processing of a retried request;
- version matching prevents a valid-looking request from overwriting newer
  state;
- a conflict should not be cached as a successful idempotent response;
- a replayed successful request may return its original version.

Do not use an idempotency key as a substitute for `expectedVersion`, and do not
use a version as a request identity.

## Tenant isolation

Versions are scoped to the tenant-aware internal service key. A service with id
`billing` in one tenant cannot consume or advance the version for `billing` in
another tenant. Responses expose only the public service id and numeric
version. The internal separator remains an implementation detail.

## Legacy rows and reset behavior

Services created before this policy have no version entry. The first read
materializes version `1`; the first guarded update advances it to `2`. A service
that is deleted loses its version entry, and a later registration starts at
`1` rather than inheriting the deleted resource's history.

The explicit admin reset clears service data and the version map together. Test
fixtures that seed `servicesStore` directly are treated as legacy rows and are
materialized at version `1` on their first read.

## Observability and safety

Count conflicts with low-cardinality fields such as `operation=price` or
`operation=metadata` and `outcome=version_conflict`. Never log full request
bodies, API keys, tenant secrets, or internal storage keys. A high conflict
rate usually indicates callers are retrying without re-reading or two control
planes are editing the same service; it is not a reason to disable OCC.

The policy does not merge fields, add an audit trail, or choose which business
decision is correct. The client must re-read and submit intentional new state.
