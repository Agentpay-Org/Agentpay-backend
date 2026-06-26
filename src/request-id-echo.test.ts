import assert from "node:assert";
import { describe, it } from "node:test";
import request from "supertest";
import { app } from "./index.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function assertUuid(value: unknown): asserts value is string {
  if (typeof value !== "string") {
    assert.fail("expected a string UUID");
  }
  assert.match(value, uuidPattern);
}

void describe("X-Request-Id echo and correlation", () => {
  void it("echoes a caller-provided request id up to 200 characters", async () => {
    const callerId = "r".repeat(200);

    const res = await request(app).get("/health").set("X-Request-Id", callerId);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["x-request-id"], callerId);
  });

  void it("mints a valid UUID request id when the header is missing", async () => {
    const res = await request(app).get("/health");

    assert.strictEqual(res.status, 200);
    assertUuid(res.headers["x-request-id"]);
  });

  void it("mints a fresh UUID request id when the supplied header is over 200 characters", async () => {
    const tooLongCallerId = "r".repeat(201);

    const res = await request(app)
      .get("/health")
      .set("X-Request-Id", tooLongCallerId);

    assert.strictEqual(res.status, 200);
    assert.notStrictEqual(res.headers["x-request-id"], tooLongCallerId);
    assertUuid(res.headers["x-request-id"]);
  });

  void it("uses the same caller-provided id in a 404 response header and body", async () => {
    const callerId = "trace-404-correlation";

    const res = await request(app)
      .get("/api/v1/missing-route")
      .set("X-Request-Id", callerId);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.headers["x-request-id"], callerId);
    assert.strictEqual(res.body?.requestId, callerId);
  });

  void it("uses the same minted UUID in a 404 response header and body when missing", async () => {
    const res = await request(app).get("/api/v1/missing-route");

    assert.strictEqual(res.status, 404);
    const headerId = res.headers["x-request-id"];
    assertUuid(headerId);
    assert.strictEqual(res.body?.requestId, headerId);
  });
});
