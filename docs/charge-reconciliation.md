# Charge reconciliation

`runChargeReconciliation()` is a callable, side-effect-free job for detecting
drift in the in-memory charge ledger. It reports problems for operators and
callers to investigate; it never changes a charge, marks a charge paid, or
attempts an automatic repair.

## Charge model

Charge amounts are non-negative safe integers in the application's smallest
currency unit. They must not be JavaScript floating-point amounts. A charge
contains the following fields:

| Field | Meaning |
| ----- | ------- |
| `id` | Stable charge identifier |
| `amount` | Original authorized amount |
| `capturedAmount` | Funds captured against the authorization |
| `refundedAmount` | Funds returned from the capture |
| `status` | Lifecycle state for the record |

The supported status values are `pending`, `authorized`, `captured`,
`partially_refunded`, `refunded`, and `failed`.

## Invariants

The checker evaluates each invariant separately. A record can therefore show
both a numeric imbalance and a lifecycle status mismatch in one report.

1. `id` is non-empty.
2. `amount`, `capturedAmount`, and `refundedAmount` are non-negative safe
   integers.
3. `capturedAmount` cannot exceed `amount`.
4. `refundedAmount` cannot exceed `capturedAmount`.
5. `pending` and `authorized` records have no captured or refunded funds.
6. `captured` records have a positive capture and no refund.
7. `partially_refunded` records refund more than zero and less than the full
   captured amount.
8. `refunded` records have a positive capture and a refund equal to that
   capture.
9. `failed` records have no captured or refunded funds.
10. A scan cannot contain the same charge ID twice.

The list is intentionally explicit. A future state or partial-capture rule
should be added as a named invariant and a named test rather than hidden in a
large predicate. `checkChargeInvariants(charge)` is the individually testable
unit for this purpose.

## Bounded scan behavior

The job accepts an `Iterable<ChargeRecord>` and consumes no more than
`maxRecords`. The default maximum is 10,000 and the hard maximum is 100,000.
Records are evaluated in chunks of 500 by default; callers can select a chunk
size up to 1,000. The chunk size controls work batches and does not change the
result.

When the input has more records than the limit, `truncated` is `true`. The
report still describes exactly how many records were evaluated. The iterator
is not converted to an unbounded array, which keeps memory use proportional to
the configured chunk and report sizes. One look-ahead is used to determine
whether a bounded scan has a tail; the look-ahead record is not inspected.

Limits above the hard maximum are clamped. Zero, negative, fractional, and
non-finite limits raise `ChargeReconciliationError` with the stable
`INVALID_OPTIONS` code. The error message is explanatory but callers should
branch on the code.

## Report contract

The result has this shape:

```ts
{
  scanned: number,
  maxRecords: number,
  chunkSize: number,
  truncated: boolean,
  violationCount: number,
  offendingIds: string[],
  violations: Array<{
    chargeId: string,
    code: ChargeInvariantCode,
    reason: string
  }>
}
```

`offendingIds` contains unique, sorted IDs. `violations` is sorted by charge
ID, invariant code, and reason. Sorting makes repeated runs comparable even
when a backing store returns records in a different insertion order. The
report contains no object references that the job uses to write back into the
ledger.

The report is suitable for structured logs, metrics adapters, and an operator
dashboard. For example, a caller can count `CAPTURE_EXCEEDS_AMOUNT` separately
from `REFUNDED_BALANCE` without parsing human-readable text. It can also use
`truncated` to avoid treating a partial scan as proof that the full ledger is
healthy.

## Example

```ts
import { runChargeReconciliation } from "./services/chargeReconciliation.js";

const report = runChargeReconciliation({ maxRecords: 25_000, chunkSize: 500 });
if (report.truncated) {
  console.warn("charge reconciliation reached its scan limit", report.scanned);
}
if (report.violationCount > 0) {
  console.error("charge drift detected", {
    count: report.violationCount,
    ids: report.offendingIds,
    violations: report.violations,
  });
}
```

The job is intentionally callable rather than scheduled. Cron, a queue
worker, or an administrative command can invoke it according to deployment
needs. Scheduling, locking between processes, remediation, and persistence of
reports are outside this job's scope.

## Operating the result

- Treat any violation as an investigation signal, not as permission to debit,
  refund, or rewrite the record automatically.
- Alert on the total count and group alerts by invariant code.
- Preserve the report together with the scan timestamp and deployment version
  when it is exported to a durable monitoring system.
- Investigate `truncated: true` separately; a zero count on a partial scan is
  not a zero count for the ledger.
- Run the job against a stable ledger snapshot when the backing store supports
  snapshots. The current development store is process-local and callers are
  responsible for choosing an appropriate read boundary.
- Keep amount units and status transitions documented with the payment
  integration that writes the ledger.

Because the job has no writes, it is safe to repeat. The same input snapshot
produces the same report, and running a scan cannot hide or heal the drift it
found. This makes the result appropriate for retries and periodic checks.
