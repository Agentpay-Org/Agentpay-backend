import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { sanitizeRequestId } from "./middleware/index.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

void describe("request id sanitization", () => {
  void it("preserves safe gateway-provided request ids", async () => {
    const app = createApp();
    const safeId = "gateway.Trace_123-abc";

    const res = await request(app).get("/health").set("X-Request-Id", safeId);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["x-request-id"], safeId);
  });

  void it("replaces CRLF and other control-character ids with UUIDs", () => {
    for (const unsafeId of ["trace\r\nInjected: yes", "trace\u0000id", "trace\tid"]) {
      const sanitized = sanitizeRequestId(unsafeId);

      assert.notStrictEqual(sanitized, unsafeId);
      assert.match(sanitized, uuidPattern);
    }
  });

  void it("replaces empty and oversized ids with UUIDs", () => {
    for (const unsafeId of ["", "x".repeat(201), undefined]) {
      const sanitized = sanitizeRequestId(unsafeId);

      assert.match(sanitized, uuidPattern);
    }
  });

  void it("does not echo an invalid id into response headers or error bodies", async () => {
    const app = createApp();
    const unsafeId = "bad\tid";

    const res = await request(app)
      .get("/api/v1/unknown-route")
      .set("X-Request-Id", unsafeId);

    assert.strictEqual(res.status, 404);
    assert.notStrictEqual(res.headers["x-request-id"], unsafeId);
    assert.match(res.headers["x-request-id"], uuidPattern);
    const bodyRequestId = res.body?.requestId as unknown;
    if (typeof bodyRequestId !== "string") {
      assert.fail("Expected response body to include a string requestId");
    }
    assert.notStrictEqual(bodyRequestId, unsafeId);
    assert.match(bodyRequestId, uuidPattern);
  });
});
