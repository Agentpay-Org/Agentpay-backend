import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { runChargeReconciliation } from "./services/chargeReconciliation.js";
import { chargeStore } from "./store/state.js";

beforeEach(() => {
  chargeStore.clear();
});

void describe("charge reconciliation integration", () => {
  void it("scans the shared charge store and returns a stable operator summary", () => {
    chargeStore.set("charge_ok", {
      id: "charge_ok",
      amount: 10_000,
      capturedAmount: 10_000,
      refundedAmount: 0,
      status: "captured",
    });
    chargeStore.set("charge_drifted", {
      id: "charge_drifted",
      amount: 10_000,
      capturedAmount: 10_001,
      refundedAmount: 0,
      status: "captured",
    });

    const report = runChargeReconciliation({ chunkSize: 1 });

    assert.equal(report.scanned, 2);
    assert.equal(report.violationCount, 1);
    assert.deepEqual(report.offendingIds, ["charge_drifted"]);
    assert.equal(report.violations[0]?.code, "CAPTURE_EXCEEDS_AMOUNT");
    assert.equal(chargeStore.get("charge_drifted")?.capturedAmount, 10_001);
  });

  void it("can be safely repeated against the same store snapshot", () => {
    chargeStore.set("charge_status_drift", {
      id: "charge_status_drift",
      amount: 2_000,
      capturedAmount: 2_000,
      refundedAmount: 0,
      status: "pending",
    });

    const first = runChargeReconciliation();
    const second = runChargeReconciliation();

    assert.deepEqual(second, first);
  });
});
