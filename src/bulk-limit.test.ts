import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import {
  config,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
} from "./store/state.js";

const defaultConfig = {
  rateLimitPerWindow: 60,
  rateLimitWindowMs: 60_000,
  bulkMaxItems: 100,
  eventLogCap: 10_000,
};

beforeEach(() => {
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  Object.assign(config, defaultConfig);
});

function usageItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    agent: `agent-${i}`,
    serviceId: `svc-${i}`,
    requests: 1,
  }));
}

function serviceItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    serviceId: `svc-${i}`,
    priceStroops: i,
  }));
}

void describe("runtime bulkMaxItems limits", () => {
  void it("applies a lowered bulkMaxItems limit to usage bulk writes immediately", async () => {
    const app = createApp();

    const patched = await request(app)
      .patch("/api/v1/config")
      .send({ bulkMaxItems: 2 });
    assert.strictEqual(patched.status, 200);
    assert.strictEqual(patched.body.config.bulkMaxItems, 2);

    const overLimit = await request(app)
      .post("/api/v1/usage/bulk")
      .set("X-Request-Id", "usage-bulk-over-limit")
      .send({ items: usageItems(3) });
    assert.strictEqual(overLimit.status, 400);
    assert.deepStrictEqual(overLimit.body, {
      error: "invalid_request",
      message: "items must be a non-empty array of up to 2 entries",
      requestId: "usage-bulk-over-limit",
    });

    const atLimit = await request(app)
      .post("/api/v1/usage/bulk")
      .send({ items: usageItems(2) });
    assert.strictEqual(atLimit.status, 201);
    assert.strictEqual(atLimit.body.results.length, 2);
  });

  void it("applies a raised bulkMaxItems limit to services bulk writes", async () => {
    const app = createApp();

    const patched = await request(app)
      .patch("/api/v1/config")
      .send({ bulkMaxItems: 60 });
    assert.strictEqual(patched.status, 200);
    assert.strictEqual(patched.body.config.bulkMaxItems, 60);

    const created = await request(app)
      .post("/api/v1/services/bulk")
      .send({ items: serviceItems(51) });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.results.length, 51);
    assert.ok(created.body.results.every((result: { ok: boolean }) => result.ok));
  });

  void it("rejects bulkMaxItems values above the guarded maximum", async () => {
    const app = createApp();

    const rejected = await request(app)
      .patch("/api/v1/config")
      .set("X-Request-Id", "bulk-max-too-high")
      .send({ bulkMaxItems: 1001 });
    assert.strictEqual(rejected.status, 400);
    assert.deepStrictEqual(rejected.body, {
      error: "invalid_request",
      message: "bulkMaxItems must be an integer between 1 and 1000",
      requestId: "bulk-max-too-high",
    });
    assert.strictEqual(config.bulkMaxItems, 100);
  });
});
