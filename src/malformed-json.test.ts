import { describe, it } from "node:test";
import assert from "node:assert";
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { createApp } from "./index.js";
import { installErrorHandlers } from "./routes/errors.js";
import type { AgentPayRequest } from "./types.js";

const malformedJsonMessage = "Malformed JSON request body";

function assertMalformedJsonResponse(
  res: request.Response,
  leakedFragment: string
): void {
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, "invalid_request");
  assert.strictEqual(res.body.message, malformedJsonMessage);
  assert.ok(res.body.requestId);
  assert.strictEqual(res.body.method, undefined);
  assert.strictEqual(res.body.path, undefined);
  assert.ok(!JSON.stringify(res.body).includes(leakedFragment));
  assert.ok(!JSON.stringify(res.body).includes("SyntaxError"));
}

void describe("malformed JSON handling", () => {
  for (const [label, body, leakedFragment] of [
    ["truncated JSON", '{"agent":', '{"agent":'],
    ["trailing comma", '{"agent":"agent-a",}', "agent-a"],
    ["plain text with JSON content type", "not-json-body", "not-json-body"],
  ] as const) {
    void it(`returns a stable 400 for ${label}`, async () => {
      const app = createApp();

      const res = await request(app)
        .post("/api/v1/usage")
        .set("Content-Type", "application/json")
        .send(body);

      assertMalformedJsonResponse(res, leakedFragment);
    });
  }

  void it("continues to accept valid JSON bodies", async () => {
    const app = createApp();

    const res = await request(app).post("/api/v1/usage").send({
      agent: "agent-json-ok",
      serviceId: "svc-json-ok",
      requests: 3,
    });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body, {
      agent: "agent-json-ok",
      serviceId: "svc-json-ok",
      total: 3,
    });
  });

  void it("keeps oversized JSON bodies mapped to 413", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/usage")
      .send({ value: "x".repeat(101 * 1024) });

    assert.strictEqual(res.status, 413);
    assert.strictEqual(res.body.error, "payload_too_large");
    assert.strictEqual(res.body.message, "request body exceeds the 100 KiB limit");
    assert.ok(res.body.requestId);
  });

  void it("keeps genuine server errors mapped to 500", async () => {
    const app = express();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as AgentPayRequest).id = "test-request-id";
      next();
    });
    app.get("/boom", () => {
      throw new Error("database unavailable");
    });
    installErrorHandlers(app);

    const res = await request(app).get("/boom");

    assert.strictEqual(res.status, 500);
    assert.strictEqual(res.body.error, "internal_error");
    assert.strictEqual(res.body.message, "database unavailable");
    assert.strictEqual(res.body.requestId, "test-request-id");
  });
});
