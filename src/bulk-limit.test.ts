import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import {
  BULK_MAX_ITEMS_MAX,
  config,
  pauseState,
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

const usageItem = (index: number) => ({
  agent: `agent-${index}`,
  serviceId: `svc-${index}`,
  requests: 1,
});

const serviceItem = (index: number) => ({
  serviceId: `svc-${index}`,
  priceStroops: index,
});

beforeEach(() => {
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  pauseState.paused = false;
  Object.assign(config, defaultConfig);
});

void describe("runtime bulkMaxItems limit", () => {
  void it("rejects one-over batches using the default limit on both bulk endpoints", async () => {
    const app = createApp();
    const items = Array.from({ length: 101 }, (_, i) => usageItem(i));

    const usage = await request(app).post("/api/v1/usage/bulk").send({ items });
    assert.strictEqual(usage.status, 400);
    assert.strictEqual(usage.body.error, "invalid_request");
    assert.strictEqual(
      usage.body.message,
      "items must be a non-empty array of up to 100 entries"
    );

    const services = await request(app)
      .post("/api/v1/services/bulk")
      .send({ items: items.map((_, i) => serviceItem(i)) });
    assert.strictEqual(services.status, 400);
    assert.strictEqual(services.body.error, "invalid_request");
    assert.strictEqual(
      services.body.message,
      "items must be a non-empty array of up to 100 entries"
    );
  });

  void it("applies a lowered limit immediately to usage bulk requests", async () => {
    const app = createApp();

    const patch = await request(app).patch("/api/v1/config").send({ bulkMaxItems: 2 });
    assert.strictEqual(patch.status, 200);
    assert.strictEqual(patch.body.config.bulkMaxItems, 2);

    const atLimit = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          usageItem(1),
          { agent: "agent-bad", serviceId: "svc-bad", requests: 0 },
        ],
      });
    assert.strictEqual(atLimit.status, 201);
    assert.deepStrictEqual(
      atLimit.body.results.map((r: { ok: boolean }) => r.ok),
      [true, false]
    );

    const overLimit = await request(app)
      .post("/api/v1/usage/bulk")
      .send({ items: [usageItem(1), usageItem(2), usageItem(3)] });
    assert.strictEqual(overLimit.status, 400);
    assert.strictEqual(
      overLimit.body.message,
      "items must be a non-empty array of up to 2 entries"
    );

    const raised = await request(app).patch("/api/v1/config").send({ bulkMaxItems: 3 });
    assert.strictEqual(raised.status, 200);

    const afterRaise = await request(app)
      .post("/api/v1/usage/bulk")
      .send({ items: [usageItem(4), usageItem(5), usageItem(6)] });
    assert.strictEqual(afterRaise.status, 201);
    assert.strictEqual(afterRaise.body.results.length, 3);
  });

  void it("applies a lowered and raised limit immediately to services bulk requests", async () => {
    const app = createApp();

    const lowered = await request(app)
      .patch("/api/v1/config")
      .send({ bulkMaxItems: 1 });
    assert.strictEqual(lowered.status, 200);

    const atLimit = await request(app)
      .post("/api/v1/services/bulk")
      .send({ items: [serviceItem(1)] });
    assert.strictEqual(atLimit.status, 201);
    assert.strictEqual(atLimit.body.results.length, 1);

    const overLimit = await request(app)
      .post("/api/v1/services/bulk")
      .send({ items: [serviceItem(2), serviceItem(3)] });
    assert.strictEqual(overLimit.status, 400);
    assert.strictEqual(
      overLimit.body.message,
      "items must be a non-empty array of up to 1 entries"
    );

    const raised = await request(app)
      .patch("/api/v1/config")
      .send({ bulkMaxItems: 51 });
    assert.strictEqual(raised.status, 200);

    const afterRaise = await request(app)
      .post("/api/v1/services/bulk")
      .send({ items: Array.from({ length: 51 }, (_, i) => serviceItem(i)) });
    assert.strictEqual(afterRaise.status, 201);
    assert.strictEqual(afterRaise.body.results.length, 51);
  });

  void it("rejects bulkMaxItems values above the memory-safe maximum", async () => {
    const app = createApp();

    const res = await request(app)
      .patch("/api/v1/config")
      .send({ bulkMaxItems: BULK_MAX_ITEMS_MAX + 1 });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.strictEqual(
      res.body.message,
      `bulkMaxItems must be a positive integer up to ${BULK_MAX_ITEMS_MAX}`
    );

    const current = await request(app).get("/api/v1/config");
    assert.strictEqual(current.status, 200);
    assert.strictEqual(current.body.config.bulkMaxItems, 100);
  });
});
