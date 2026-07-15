import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { eventLog } from "./events.js";
import { createApp } from "./index.js";
import {
  apiKeyStore,
  config,
  pauseState,
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

beforeEach(() => {
  apiKeyStore.clear();
  eventLog.length = 0;
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  pauseState.paused = false;
  Object.assign(config, defaultConfig);
});

void describe("content type guard", () => {
  void it("allows correctly typed JSON writes and preserves validation errors", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/v1/usage")
      .type("application/json")
      .send({ agent: "agent-json", serviceId: "svc-json", requests: 2 });
    assert.strictEqual(created.status, 201);

    const invalidJson = await request(app)
      .post("/api/v1/usage")
      .type("application/json")
      .send({ agent: "", serviceId: "svc-json", requests: 1 });
    assert.strictEqual(invalidJson.status, 400);
    assert.strictEqual(invalidJson.body.error, "invalid_request");
  });

  void it("returns 415 for text bodies on write endpoints", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/v1/usage")
      .type("text/plain")
      .send('{"agent":"agent-text","serviceId":"svc-text","requests":1}');

    assert.strictEqual(response.status, 415);
    assert.strictEqual(response.body.error, "unsupported_media_type");
    assert.ok(response.body.message.includes("Content-Type"));
    assert.ok(response.body.requestId);
  });

  void it("returns 415 for write bodies with an empty content type", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/v1/usage")
      .set("Content-Type", "")
      .send('{"agent":"agent-missing","serviceId":"svc-missing","requests":1}');

    assert.strictEqual(response.status, 415);
    assert.strictEqual(response.body.error, "unsupported_media_type");
  });

  void it("allows bodyless writes and leaves reads unaffected", async () => {
    const app = createApp();

    const paused = await request(app).post("/api/v1/admin/pause");
    assert.strictEqual(paused.status, 200);
    assert.deepStrictEqual(paused.body, { paused: true });

    const health = await request(app).get("/health").type("text/plain");
    assert.strictEqual(health.status, 200);
  });
});
