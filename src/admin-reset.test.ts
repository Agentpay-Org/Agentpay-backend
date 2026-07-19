import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { eventLog, recordEvent } from "./events.js";
import {
  apiKeyStore,
  config,
  DEFAULT_CONFIG,
  pauseState,
  rateBuckets,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
  webhookStore,
} from "./store/state.js";

const originalAllowAdminReset = process.env.ALLOW_ADMIN_RESET;

function resetTestState(): void {
  apiKeyStore.clear();
  eventLog.length = 0;
  rateBuckets.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  pauseState.paused = false;
  Object.assign(config, DEFAULT_CONFIG);
}

function restoreAllowAdminReset(): void {
  if (originalAllowAdminReset === undefined) {
    delete process.env.ALLOW_ADMIN_RESET;
  } else {
    process.env.ALLOW_ADMIN_RESET = originalAllowAdminReset;
  }
}

function seedState(): void {
  apiKeyStore.set("apk_seeded", { label: "ops", createdAt: 1, prefix: "apk_see" });
  rateBuckets.set("127.0.0.1", [1, 2, 3]);
  servicesDisabled.add("svc-reset");
  servicesMetadata.set("svc-reset", { description: "demo", owner: "ops" });
  servicesStore.set("svc-reset", { priceStroops: 7 });
  usageStore.set("agent-reset::svc-reset", 9);
  webhookStore.set("wh_seeded", {
    url: "https://example.test/hook",
    events: ["usage.recorded"],
    createdAt: 2,
  });
  pauseState.paused = true;
  config.bulkMaxItems = 42;
  recordEvent("usage.recorded", { agent: "agent-reset", serviceId: "svc-reset" });
}

beforeEach(() => {
  resetTestState();
  delete process.env.ALLOW_ADMIN_RESET;
});

afterEach(() => {
  resetTestState();
  restoreAllowAdminReset();
});

void describe("admin reset route", () => {
  void it("refuses reset while the explicit env gate is disabled", async () => {
    const app = createApp();
    seedState();

    const res = await request(app).post("/api/v1/admin/reset");

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, "not_found");
    assert.strictEqual(res.body.message, "admin reset is disabled");
    assert.strictEqual(usageStore.size, 1);
    assert.strictEqual(servicesStore.size, 1);
    assert.strictEqual(webhookStore.size, 1);
    assert.strictEqual(eventLog.length, 1);
    assert.strictEqual(rateBuckets.size, 1);
    assert.strictEqual(pauseState.paused, true);
    assert.strictEqual(config.bulkMaxItems, 42);
  });

  void it("clears all in-memory stores and returns a cleared-state summary", async () => {
    process.env.ALLOW_ADMIN_RESET = "true";
    const app = createApp();
    seedState();

    const res = await request(app).post("/api/v1/admin/reset");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.reset, true);
    assert.deepStrictEqual(res.body.cleared, {
      usage: 1,
      services: 1,
      servicesMetadata: 1,
      servicesDisabled: 1,
      apiKeys: 1,
      webhooks: 1,
      eventLog: 1,
      rateBuckets: 1,
      paused: true,
      config: {
        rateLimitPerWindow: 60,
        rateLimitWindowMs: 60_000,
        bulkMaxItems: 42,
        eventLogCap: 10_000,
      },
    });
    assert.strictEqual(res.body.paused, false);
    assert.deepStrictEqual(res.body.config, DEFAULT_CONFIG);
    assert.strictEqual(res.body.auditEvent.type, "admin.reset");
    assert.deepStrictEqual(res.body.auditEvent.payload.cleared, res.body.cleared);

    assert.strictEqual(usageStore.size, 0);
    assert.strictEqual(servicesStore.size, 0);
    assert.strictEqual(servicesMetadata.size, 0);
    assert.strictEqual(servicesDisabled.size, 0);
    assert.strictEqual(apiKeyStore.size, 0);
    assert.strictEqual(webhookStore.size, 0);
    assert.strictEqual(eventLog.length, 0);
    assert.strictEqual(rateBuckets.size, 0);
    assert.strictEqual(pauseState.paused, false);
    assert.deepStrictEqual(config, DEFAULT_CONFIG);
  });

  void it("is safe to call repeatedly on an already-empty backend", async () => {
    process.env.ALLOW_ADMIN_RESET = "1";
    const app = createApp();

    const first = await request(app).post("/api/v1/admin/reset");
    const second = await request(app).post("/api/v1/admin/reset");

    assert.strictEqual(first.status, 200);
    assert.strictEqual(second.status, 200);
    assert.deepStrictEqual(first.body.cleared, {
      usage: 0,
      services: 0,
      servicesMetadata: 0,
      servicesDisabled: 0,
      apiKeys: 0,
      webhooks: 0,
      eventLog: 0,
      rateBuckets: 0,
      paused: false,
      config: DEFAULT_CONFIG,
    });
    assert.deepStrictEqual(second.body.cleared, first.body.cleared);
    assert.strictEqual(eventLog.length, 0);
    assert.strictEqual(rateBuckets.size, 0);
  });

  void it("does not treat arbitrary env values as enabling production reset", async () => {
    process.env.ALLOW_ADMIN_RESET = "enabled";
    const app = createApp();
    seedState();

    const res = await request(app).post("/api/v1/admin/reset");

    assert.strictEqual(res.status, 404);
    assert.strictEqual(usageStore.size, 1);
    assert.strictEqual(eventLog.length, 1);
  });
});
