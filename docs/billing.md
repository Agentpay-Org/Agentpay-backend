# Billing Amounts

AgentPay keeps usage counts and registered service prices as safe JSON integers,
then converts them to `BigInt` for billing arithmetic.

## Response Types

The billing APIs serialize stroop totals as decimal strings:

| Endpoint                                | Field           | Type   |
| --------------------------------------- | --------------- | ------ |
| `GET /api/v1/billing/:agent/:serviceId` | `billedStroops` | string |
| `POST /api/v1/settle`                   | `billedStroops` | string |
| `GET /api/v1/billing/total`             | `totalStroops`  | string |

The string shape is intentional. JSON numbers cannot exactly represent every
integer above `Number.MAX_SAFE_INTEGER`, while stroop totals can exceed that
limit when large request counts are multiplied by per-request prices.

Clients should parse these fields with `BigInt`, a decimal library, or keep them
as strings when forwarding settlement values.
