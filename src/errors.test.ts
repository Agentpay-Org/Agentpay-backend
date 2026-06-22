import { describe, it } from "node:test";
import assert from "node:assert";
import request, { type Response } from "supertest";
import { app } from "./index.js";

type ErrorEnvelope = {
  error?: unknown;
  message?: unknown;
  method?: unknown;
  path?: unknown;
  requestId?: unknown;
};

function assertErrorEnvelope(
  res: Response,
  expected: { status: number; error: string }
) {
  assert.strictEqual(res.status, expected.status);
  const body = res.body as ErrorEnvelope;
  assert.strictEqual(body.error, expected.error);
  assert.strictEqual(typeof body.message, "string");
  assert.ok((body.message as string).length > 0);
  assert.strictEqual(typeof body.requestId, "string");
  assert.ok((body.requestId as string).length > 0);
  assert.strictEqual(res.headers["x-request-id"], body.requestId);
  return body;
}

void describe("Error responses", () => {
  void it("returns 413 payload_too_large with requestId for oversized JSON bodies", async () => {
    const res = await request(app)
      .post("/api/v1/usage")
      .set("Content-Type", "application/json")
      .send({ payload: "x".repeat(101 * 1024) });

    const body = assertErrorEnvelope(res, {
      status: 413,
      error: "payload_too_large",
    });
    assert.match(body.message as string, /100 KiB limit/);
  });

  void it("returns a structured internal_error for malformed JSON without stack details", async () => {
    const callerRequestId = "malformed-json-test-request";
    const res = await request(app)
      .post("/api/v1/usage")
      .set("X-Request-Id", callerRequestId)
      .set("Content-Type", "application/json")
      .send('{"agent": "alice",');

    const body = assertErrorEnvelope(res, {
      status: 500,
      error: "internal_error",
    });
    assert.strictEqual(body.requestId, callerRequestId);
    assert.strictEqual(body.method, "POST");
    assert.strictEqual(body.path, "/api/v1/usage");
    assert.doesNotMatch(body.message as string, /src\/index|dist\/index|node_modules/);
    assert.doesNotMatch(res.text, /SyntaxError:|at parse|node_modules/);
  });

  for (const method of ["get", "post", "patch", "delete"] as const) {
    void it(`${method.toUpperCase()} unknown route returns 404 not_found with method, path, and requestId`, async () => {
      const path = `/api/v1/missing-${method}`;
      const res = await request(app)[method](path);

      const body = assertErrorEnvelope(res, {
        status: 404,
        error: "not_found",
      });
      assert.strictEqual(body.message, `No route for ${method.toUpperCase()} ${path}`);
    });
  }
});
