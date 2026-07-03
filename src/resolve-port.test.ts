import { describe, it } from "node:test";
import assert from "node:assert";
import { resolvePort } from "./index.js";

void describe("resolvePort", () => {
  void it("uses the documented default when PORT is unset", () => {
    assert.strictEqual(resolvePort({}), 3001);
  });

  void it("accepts an integer TCP port from the environment", () => {
    assert.strictEqual(resolvePort({ PORT: "3000" }), 3000);
    assert.strictEqual(resolvePort({ PORT: "65535" }), 65535);
  });

  void it("rejects invalid PORT values with a clear message", () => {
    for (const value of ["", "abc", "0", "70000", "3000.5"]) {
      assert.throws(
        () => resolvePort({ PORT: value }),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes("PORT") &&
          error.message.includes(JSON.stringify(value)) &&
          error.message.includes("1-65535")
      );
    }
  });
});
