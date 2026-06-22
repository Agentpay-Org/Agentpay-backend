import { describe, it } from "node:test";
import assert from "node:assert";
import { multiplyStroops, sumStroops } from "./stroops.js";

void describe("stroops arithmetic", () => {
  void it("multiplies request counts and prices exactly above Number.MAX_SAFE_INTEGER", () => {
    const billed = multiplyStroops(Number.MAX_SAFE_INTEGER, 100);

    assert.strictEqual(billed, "900719925474099100");
  });

  void it("keeps zero-price services at an exact zero string", () => {
    assert.strictEqual(multiplyStroops(Number.MAX_SAFE_INTEGER, 0), "0");
  });

  void it("sums billed stroops without converting back to Number", () => {
    const total = sumStroops([
      multiplyStroops(Number.MAX_SAFE_INTEGER, 100),
      multiplyStroops(7, 3),
    ]);

    assert.strictEqual(total, "900719925474099121");
  });
});
