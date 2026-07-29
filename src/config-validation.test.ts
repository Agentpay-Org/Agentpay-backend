import { describe, it } from "node:test";
import assert from "node:assert";
import { validateConfigPatchBody } from "./configValidation.js";

void describe("config validation helper", () => {
  void it("accepts valid config patch bodies", () => {
    assert.deepStrictEqual(validateConfigPatchBody({ bulkMaxItems: 50 }), {
      ok: true,
      updates: { bulkMaxItems: 50 },
    });
    assert.deepStrictEqual(validateConfigPatchBody({ eventLogCap: 2_000 }), {
      ok: true,
      updates: { eventLogCap: 2_000 },
    });
  });

  void it("rejects malformed, unknown, and out-of-range values", () => {
    assert.deepStrictEqual(validateConfigPatchBody([]), {
      ok: false,
      message: "body must be a JSON object",
    });
    assert.deepStrictEqual(validateConfigPatchBody({ rateLimitPerWindw: 10 }), {
      ok: false,
      message: "unknown config keys: rateLimitPerWindw",
      unknownKeys: ["rateLimitPerWindw"],
    });
    assert.deepStrictEqual(validateConfigPatchBody({ eventLogCap: 2.5 }), {
      ok: false,
      message: "eventLogCap must be a positive integer",
    });
    assert.deepStrictEqual(validateConfigPatchBody({ bulkMaxItems: 0 }), {
      ok: false,
      message: "bulkMaxItems must be an integer between 1 and 1000",
    });
  });
});
