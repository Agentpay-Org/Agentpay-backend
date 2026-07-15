import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { createApp } from "./index.js";
import { installPreRouteMiddleware } from "./middleware/index.js";
import { installErrorHandlers } from "./routes/errors.js";
import { usageStore } from "./store/state.js";

const originalConsoleError = console.error;

beforeEach(() => {
  usageStore.clear();
});

afterEach(() => {
  console.error = originalConsoleError;
});

function createThrowingApp() {
  const app = express();
  installPreRouteMiddleware(app);
  app.get("/boom", () => {
    throw new Error("sensitive path /var/private/token.txt");
  });
  installErrorHandlers(app);
  return app;
}

void describe("terminal error handling", () => {
  void it("returns a structured 400 for malformed JSON without leaking parser text", async () => {
    const res = await request(createApp())
      .post("/api/v1/usage")
      .set("Content-Type", "application/json")
      .set("X-Request-Id", "bad-json-request")
      .send('{"agent":');

    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(res.body, {
      error: "invalid_request",
      message: "Malformed JSON in request body",
      requestId: "bad-json-request",
    });
    assert.strictEqual(JSON.stringify(res.body).includes("Unexpected end"), false);
    assert.strictEqual(JSON.stringify(res.body).includes('{"agent":'), false);
  });

  void it("keeps valid JSON writes unaffected", async () => {
    const res = await request(createApp())
      .post("/api/v1/usage")
      .set("X-Request-Id", "valid-json-request")
      .send({ agent: "agent-json", serviceId: "svc-json", requests: 1 });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body, {
      agent: "agent-json",
      serviceId: "svc-json",
      total: 1,
    });
  });

  void it("keeps oversized JSON mapped to payload_too_large", async () => {
    const res = await request(createApp())
      .post("/api/v1/usage")
      .set("Content-Type", "application/json")
      .set("X-Request-Id", "oversized-request")
      .send({ agent: "a".repeat(120 * 1024), serviceId: "svc-json", requests: 1 });

    assert.strictEqual(res.status, 413);
    assert.deepStrictEqual(res.body, {
      error: "payload_too_large",
      message: "request body exceeds the 100 KiB limit",
      requestId: "oversized-request",
    });
  });

  void it("redacts client-facing 500 messages while logging internal details", async () => {
    const logged: string[] = [];
    console.error = (...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    };

    const res = await request(createThrowingApp())
      .get("/boom")
      .set("X-Request-Id", "boom-request");

    assert.strictEqual(res.status, 500);
    assert.deepStrictEqual(res.body, {
      error: "internal_error",
      message: "Unexpected server error",
      method: "GET",
      path: "/boom",
      requestId: "boom-request",
    });
    assert.strictEqual(JSON.stringify(res.body).includes("/var/private"), false);
    assert.ok(logged.some((line) => line.includes("boom-request")));
    assert.ok(logged.some((line) => line.includes("/var/private/token.txt")));
  });
});
