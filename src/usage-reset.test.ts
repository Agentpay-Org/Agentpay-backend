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
  usageKey,
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

void describe("usage accumulator reset", () => {
  void it("clears an existing accumulator without billing or settlement events", async () => {
    const app = createApp();
    await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-reset", priceStroops: 11 });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-reset", serviceId: "svc-reset", requests: 4 });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-reset", serviceId: "svc-reset", requests: 3 });

    const reset = await request(app).delete("/api/v1/usage/agent-reset/svc-reset");

    assert.strictEqual(reset.status, 200);
    assert.deepStrictEqual(reset.body, {
      agent: "agent-reset",
      serviceId: "svc-reset",
      clearedTotal: 7,
    });
    assert.strictEqual(usageStore.get(usageKey("agent-reset", "svc-reset")), 0);

    const afterUsage = await request(app).get("/api/v1/usage/agent-reset/svc-reset");
    assert.strictEqual(afterUsage.body.total, 0);

    const afterBilling = await request(app).get(
      "/api/v1/billing/agent-reset/svc-reset"
    );
    assert.strictEqual(afterBilling.body.requests, 0);
    assert.strictEqual(afterBilling.body.billedStroops, 0);

    const eventTypes = eventLog.map((event) => event.type);
    assert.ok(eventTypes.includes("usage.reset"));
    assert.ok(!eventTypes.includes("usage.settled"));
    const resetEvent = eventLog.find((event) => event.type === "usage.reset");
    assert.deepStrictEqual(resetEvent?.payload, {
      agent: "agent-reset",
      serviceId: "svc-reset",
      clearedTotal: 7,
    });
  });

  void it("returns 404 for a pair that has never been recorded", async () => {
    const app = createApp();

    const reset = await request(app).delete(
      "/api/v1/usage/missing-agent/missing-service"
    );

    assert.strictEqual(reset.status, 404);
    assert.strictEqual(reset.body.error, "not_found");
    assert.ok(reset.body.requestId);
    assert.strictEqual(eventLog.length, 0);
  });

  void it("resets an already-zero recorded accumulator", async () => {
    const app = createApp();
    usageStore.set(usageKey("agent-zero", "svc-zero"), 0);

    const reset = await request(app).delete("/api/v1/usage/agent-zero/svc-zero");

    assert.strictEqual(reset.status, 200);
    assert.strictEqual(reset.body.clearedTotal, 0);
    assert.strictEqual(usageStore.get(usageKey("agent-zero", "svc-zero")), 0);
    assert.strictEqual(eventLog.at(-1)?.type, "usage.reset");
  });

  void it("is blocked by the pause guard because it is a write", async () => {
    const app = createApp();
    usageStore.set(usageKey("agent-paused", "svc-paused"), 5);
    await request(app).post("/api/v1/admin/pause");

    const reset = await request(app).delete("/api/v1/usage/agent-paused/svc-paused");

    assert.strictEqual(reset.status, 503);
    assert.strictEqual(reset.body.error, "service_paused");
    assert.strictEqual(usageStore.get(usageKey("agent-paused", "svc-paused")), 5);
    assert.strictEqual(eventLog.length, 0);
  });
});
