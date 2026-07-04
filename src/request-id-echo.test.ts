import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function responseRequestId(
  headers: Record<string, string | string[] | undefined>
): string {
  const id = headers["x-request-id"];
  assert.strictEqual(typeof id, "string", "X-Request-Id response header missing");
  return id as string;
}

void describe("X-Request-Id echo, mint, and error correlation", () => {
  void it("echoes a caller-provided request id up to the accepted length", async () => {
    const callerRequestId = "trace-123_request.id";

    const res = await request(app).get("/health").set("X-Request-Id", callerRequestId);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(responseRequestId(res.headers), callerRequestId);
  });

  void it("mints a UUID request id when the caller omits the header", async () => {
    const res = await request(app).get("/health");

    assert.strictEqual(res.status, 200);
    assert.match(responseRequestId(res.headers), uuidPattern);
  });

  void it("mints a UUID request id when the caller sends an overlong value", async () => {
    const overlongRequestId = "x".repeat(201);

    const res = await request(app)
      .get("/health")
      .set("X-Request-Id", overlongRequestId);

    assert.strictEqual(res.status, 200);
    const minted = responseRequestId(res.headers);
    assert.notStrictEqual(minted, overlongRequestId);
    assert.match(minted, uuidPattern);
  });

  void it("uses the same request id in the response header and error body", async () => {
    const callerRequestId = "not-found-correlation";

    const res = await request(app)
      .get("/api/v1/not-present")
      .set("X-Request-Id", callerRequestId);

    assert.strictEqual(res.status, 404);
    assert.strictEqual(responseRequestId(res.headers), callerRequestId);
    assert.strictEqual(res.body.requestId, callerRequestId);
    assert.strictEqual(res.body.error, "not_found");
  });

  void it("correlates a minted request id with a 404 error body", async () => {
    const res = await request(app).get("/api/v1/missing-with-minted-id");

    assert.strictEqual(res.status, 404);
    const minted = responseRequestId(res.headers);
    assert.match(minted, uuidPattern);
    assert.strictEqual(res.body.requestId, minted);
  });
});
