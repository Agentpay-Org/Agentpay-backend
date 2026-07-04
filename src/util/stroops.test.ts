import { describe, it } from "node:test";
import assert from "node:assert";
import { addStroops, multiplyStroops } from "./stroops.js";

void describe("stroops arithmetic", () => {
  void it("multiplies request counts and prices exactly above Number.MAX_SAFE_INTEGER", () => {
    assert.strictEqual(
      multiplyStroops(Number.MAX_SAFE_INTEGER, 10_000_000),
      "90071992547409910000000"
    );
  });

  void it("keeps zero-price services at an exact decimal-string zero", () => {
    assert.strictEqual(multiplyStroops(Number.MAX_SAFE_INTEGER, 0), "0");
  });

  void it("sums billed stroops without converting back to Number", () => {
    const first = multiplyStroops(Number.MAX_SAFE_INTEGER, 10_000_000);
    const second = multiplyStroops(Number.MAX_SAFE_INTEGER, 2);

    assert.strictEqual(addStroops(first, second), "90072010561808419481982");
  });
});
