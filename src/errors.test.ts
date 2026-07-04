import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { eventLog } from "./events.js";
import {
  apiKeyStore,
  config,
  pauseState,
  rateBuckets,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
  webhookStore,
} from "./store/state.js";

const defaultConfig = {
  rateLimitPerWindow: 60,
  rateLimitWindowMs: 60_000,
  bulkMaxItems: 100,
  eventLogCap: 10_000,
};

type ErrorBody = {
  error?: unknown;
  message?: unknown;
  requestId?: unknown;
  stack?: unknown;
};

function assertStructuredError(body: ErrorBody, expectedError: string) {
  assert.strictEqual(body.error, expectedError);
  assert.strictEqual(typeof body.message, "string");
  assert.ok((body.message as string).length > 0);
  assert.strictEqual(typeof body.requestId, "string");
  assert.ok((body.requestId as string).length > 0);
  assert.strictEqual(body.stack, undefined);
  assert.ok(!(body.message as string).includes("node_modules"));
}

beforeEach(() => {
  apiKeyStore.clear();
  eventLog.length = 0;
  pauseState.paused = false;
  rateBuckets.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  Object.assign(config, defaultConfig);
});

void describe("global error handling", () => {
  void it("returns a structured 413 with requestId for oversized JSON bodies", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/v1/usage")
      .send({ value: "x".repeat(101 * 1024) });

    assert.strictEqual(response.status, 413);
    assertStructuredError(response.body as ErrorBody, "payload_too_large");
    assert.strictEqual(response.body.message, "request body exceeds the 100 KiB limit");
  });

  void it("returns a structured internal error for malformed JSON bodies", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/v1/usage")
      .set("Content-Type", "application/json")
      .send('{"agent":');

    assert.strictEqual(response.status, 500);
    assertStructuredError(response.body as ErrorBody, "internal_error");
  });

  for (const method of ["get", "post"] as const) {
    void it(`returns a structured 404 with method, path, and requestId for unknown ${method.toUpperCase()} routes`, async () => {
      const app = createApp();
      const response =
        method === "post"
          ? await request(app).post("/api/v1/missing-route").send({})
          : await request(app).get("/api/v1/missing-route");

      assert.strictEqual(response.status, 404);
      assertStructuredError(response.body as ErrorBody, "not_found");
      assert.strictEqual(
        response.body.message,
        `No route for ${method.toUpperCase()} /api/v1/missing-route`
      );
    });
  }
});
