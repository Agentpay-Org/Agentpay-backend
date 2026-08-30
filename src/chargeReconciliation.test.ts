import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ChargeReconciliationError,
  checkChargeInvariants,
  reconcileCharges,
  runChargeReconciliation,
  type ChargeRecord,
} from "./services/chargeReconciliation.js";
import { chargeStore } from "./store/state.js";

const pending: ChargeRecord = {
  id: "charge_pending",
  amount: 1_000,
  capturedAmount: 0,
  refundedAmount: 0,
  status: "pending",
};

const captured: ChargeRecord = {
  id: "charge_captured",
  amount: 2_000,
  capturedAmount: 2_000,
  refundedAmount: 0,
  status: "captured",
};

const partial: ChargeRecord = {
  id: "charge_partial",
  amount: 3_000,
  capturedAmount: 3_000,
  refundedAmount: 1_000,
  status: "partially_refunded",
};

const refunded: ChargeRecord = {
  id: "charge_refunded",
  amount: 4_000,
  capturedAmount: 4_000,
  refundedAmount: 4_000,
  status: "refunded",
};

beforeEach(() => {
  chargeStore.clear();
});

void describe("charge invariant checks", () => {
  void it("accepts every consistent lifecycle state", () => {
    for (const charge of [pending, captured, partial, refunded, {
      id: "charge_authorized",
      amount: 500,
      capturedAmount: 0,
      refundedAmount: 0,
      status: "authorized",
    }, {
      id: "charge_failed",
      amount: 500,
      capturedAmount: 0,
      refundedAmount: 0,
      status: "failed",
    }] satisfies ChargeRecord[]) {
      assert.deepEqual(checkChargeInvariants(charge), []);
    }
  });

  void it("reports an injected capture imbalance with the offending id", () => {
    const invalid = { ...captured, id: "charge_imbalanced", capturedAmount: 2_001 };
    const violations = checkChargeInvariants(invalid);
    assert.deepEqual(violations.map(({ code, chargeId }) => ({ code, chargeId })), [
      { code: "CAPTURE_EXCEEDS_AMOUNT", chargeId: "charge_imbalanced" },
    ]);
  });

  void it("reports an inconsistent status independently from amount checks", () => {
    const invalid = { ...pending, id: "charge_status_drift", capturedAmount: 100, status: "pending" as const };
    const violations = checkChargeInvariants(invalid);
    assert.equal(violations.some((entry) => entry.code === "PENDING_HAS_FUNDS"), true);
    assert.equal(violations.some((entry) => entry.code === "CAPTURE_EXCEEDS_AMOUNT"), false);
  });

  void it("reports refund and lifecycle balance violations together", () => {
    const invalid = {
      ...partial,
      id: "charge_refund_drift",
      capturedAmount: 100,
      refundedAmount: 100,
      status: "partially_refunded" as const,
    };
    assert.deepEqual(checkChargeInvariants(invalid).map((entry) => entry.code), [
      "PARTIAL_REFUND_BALANCE",
    ]);
  });
});

void describe("charge reconciliation job", () => {
  void it("returns a zero-violation report for consistent data", () => {
    const report = reconcileCharges([pending, captured, partial, refunded]);
    assert.deepEqual(report, {
      scanned: 4,
      maxRecords: 10_000,
      chunkSize: 500,
      truncated: false,
      violationCount: 0,
      offendingIds: [],
      violations: [],
    });
  });

  void it("collects offending ids and structured reasons", () => {
    const records = [
      { ...captured, id: "charge_z", capturedAmount: 2_001 },
      { ...pending, id: "charge_a", capturedAmount: 1 },
    ];
    const report = reconcileCharges(records, { chunkSize: 1 });
    assert.equal(report.violationCount, 2);
    assert.deepEqual(report.offendingIds, ["charge_a", "charge_z"]);
    assert.deepEqual(report.violations.map((entry) => entry.code), [
      "PENDING_HAS_FUNDS",
      "CAPTURE_EXCEEDS_AMOUNT",
    ]);
  });

  void it("bounds a large iterable without materializing its tail", () => {
    let yielded = 0;
    const source: Iterable<ChargeRecord> = {
      [Symbol.iterator]: function* () {
        while (true) {
          yielded += 1;
          yield { ...pending, id: `charge_${yielded}` };
        }
      },
    };
    const report = reconcileCharges(source, { maxRecords: 7, chunkSize: 3 });
    assert.equal(report.scanned, 7);
    assert.equal(report.truncated, true);
    assert.equal(yielded, 8);
    assert.equal(report.violations.length, 0);
  });

  void it("marks duplicate input IDs as drift", () => {
    const report = reconcileCharges([pending, { ...pending }]);
    assert.deepEqual(report.violations, [{
      chargeId: "charge_pending",
      code: "DUPLICATE_ID",
      reason: "charge id appeared more than once in the scan",
    }]);
  });

  void it("produces the same sorted report regardless of input order", () => {
    const first = reconcileCharges([
      { ...captured, id: "charge_b", capturedAmount: 2_001 },
      { ...pending, id: "charge_a", capturedAmount: 1 },
    ]);
    const second = reconcileCharges([
      { ...pending, id: "charge_a", capturedAmount: 1 },
      { ...captured, id: "charge_b", capturedAmount: 2_001 },
    ]);
    assert.deepEqual(first.violations, second.violations);
    assert.deepEqual(first.offendingIds, second.offendingIds);
  });

  void it("does not mutate the ledger while producing a report", () => {
    chargeStore.set(pending.id, pending);
    chargeStore.set("charge_bad", { ...captured, id: "charge_bad", capturedAmount: 2_001 });
    const before = [...chargeStore.entries()];
    const report = runChargeReconciliation({ maxRecords: 10 });
    assert.equal(report.violationCount, 1);
    assert.deepEqual([...chargeStore.entries()], before);
  });

  void it("clamps oversized limits and rejects invalid limits with stable errors", () => {
    const report = reconcileCharges([], { maxRecords: 999_999, chunkSize: 999_999 });
    assert.equal(report.maxRecords, 100_000);
    assert.equal(report.chunkSize, 1_000);
    assert.throws(
      () => reconcileCharges([], { maxRecords: 0 }),
      (error: unknown) =>
        error instanceof ChargeReconciliationError && error.code === "INVALID_OPTIONS",
    );
  });
});
