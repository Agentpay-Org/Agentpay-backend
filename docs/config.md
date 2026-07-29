# Config API

Source of truth: `src/routes/config.ts`.

The config API exposes the in-memory runtime settings used by the backend.

## GET `/api/v1/config`

Returns the current config snapshot.

- **Response `200`**
  - `config`: object with the runtime numeric settings

Example:

```json
{
  "config": {
    "rateLimitPerWindow": 60,
    "rateLimitWindowMs": 60000,
    "bulkMaxItems": 100,
    "eventLogCap": 10000
  }
}
```

## PATCH `/api/v1/config`

Updates one or more runtime config fields.

### Request body

Allowed fields:

- `rateLimitPerWindow`
- `rateLimitWindowMs`
- `bulkMaxItems`
- `eventLogCap`

Each field must be a positive integer, with `bulkMaxItems` additionally capped at `1000`.

### Response

- **Response `200`**
  - `config`: updated runtime config snapshot

Example:

```json
{
  "rateLimitPerWindow": 75,
  "eventLogCap": 2000
}
```

Example response:

```json
{
  "config": {
    "rateLimitPerWindow": 75,
    "rateLimitWindowMs": 60000,
    "bulkMaxItems": 100,
    "eventLogCap": 2000
  }
}
```

### Error codes

- **`400 invalid_request`**
  - `body must be a JSON object`
  - `unexpected field: <name>`
  - `<field> must be a positive integer`
  - `bulkMaxItems must be an integer between 1 and 1000`

## Notes

- The route does not expose a `404` path; invalid inputs are reported as `400 invalid_request`.
- The response shape is intentionally stable so callers can read back the full runtime config after any successful update.
