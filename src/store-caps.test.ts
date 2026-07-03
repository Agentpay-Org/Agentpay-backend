import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
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
  usageStoreMaxKeys: 100_000,
  servicesStoreMaxKeys: 10_000,
  webhookStoreMaxKeys: 10_000,
  apiKeyStoreMaxKeys: 10_000,
};

function resetState() {
  apiKeyStore.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  pauseState.paused = false;
  Object.assign(config, defaultConfig);
}

void describe("in-memory store caps", () => {
  beforeEach(resetState);

  void it("rejects new usage keys past the usage store cap while allowing existing keys", async () => {
    const app = createApp();
    config.usageStoreMaxKeys = 1;

    const first = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc", requests: 1 });
    assert.strictEqual(first.status, 201);

    const existing = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc", requests: 2 });
    assert.strictEqual(existing.status, 201);
    assert.strictEqual(existing.body.total, 3);

    const overCap = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-b", serviceId: "svc", requests: 1 });
    assert.strictEqual(overCap.status, 429);
    assert.strictEqual(overCap.body.error, "store_capacity_exceeded");
    assert.strictEqual(usageStore.size, 1);
  });

  void it("deletes a settled usage key so capacity can be reused", async () => {
    const app = createApp();
    config.usageStoreMaxKeys = 1;

    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc", requests: 1 });
    const settled = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-a", serviceId: "svc" });
    assert.strictEqual(settled.status, 200);
    assert.strictEqual(usageStore.has("agent-a::svc"), false);

    const reused = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-b", serviceId: "svc", requests: 1 });
    assert.strictEqual(reused.status, 201);
  });

  void it("returns per-item capacity errors for bulk usage past the cap", async () => {
    const app = createApp();
    config.usageStoreMaxKeys = 2;

    const res = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "agent-a", serviceId: "svc", requests: 1 },
          { agent: "agent-b", serviceId: "svc", requests: 1 },
          { agent: "agent-c", serviceId: "svc", requests: 1 },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body.results, [
      { index: 0, ok: true, total: 1 },
      { index: 1, ok: true, total: 1 },
      { index: 2, ok: false, error: "store_capacity_exceeded" },
    ]);
    assert.strictEqual(usageStore.size, 2);
  });

  void it("caps new services, webhooks, and API keys without blocking updates", async () => {
    const app = createApp();
    config.servicesStoreMaxKeys = 1;
    config.webhookStoreMaxKeys = 1;
    config.apiKeyStoreMaxKeys = 1;

    const firstService = await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-a", priceStroops: 1 });
    assert.strictEqual(firstService.status, 201);

    const updateService = await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-a", priceStroops: 2 });
    assert.strictEqual(updateService.status, 200);

    const secondService = await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-b", priceStroops: 1 });
    assert.strictEqual(secondService.status, 429);
    assert.strictEqual(secondService.body.error, "store_capacity_exceeded");

    const firstWebhook = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/a", events: ["usage.recorded"] });
    assert.strictEqual(firstWebhook.status, 201);

    const secondWebhook = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/b", events: ["usage.recorded"] });
    assert.strictEqual(secondWebhook.status, 429);
    assert.strictEqual(secondWebhook.body.error, "store_capacity_exceeded");

    const firstKey = await request(app)
      .post("/api/v1/api-keys")
      .send({ label: "ops-a" });
    assert.strictEqual(firstKey.status, 201);

    const secondKey = await request(app)
      .post("/api/v1/api-keys")
      .send({ label: "ops-b" });
    assert.strictEqual(secondKey.status, 429);
    assert.strictEqual(secondKey.body.error, "store_capacity_exceeded");
  });

  void it("exposes current store sizes in stats and metrics", async () => {
    const app = createApp();
    await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-a", priceStroops: 1 });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc-a", requests: 2 });
    await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/a", events: ["usage.recorded"] });
    await request(app).post("/api/v1/api-keys").send({ label: "ops-a" });

    const stats = await request(app).get("/api/v1/stats");
    assert.strictEqual(stats.status, 200);
    assert.strictEqual(stats.body.usageKeys, 1);
    assert.strictEqual(stats.body.totalWebhooks, 1);

    const metrics = await request(app).get("/api/v1/metrics");
    assert.strictEqual(metrics.status, 200);
    assert.match(metrics.text, /agentpay_usage_keys_total 1/);
    assert.match(metrics.text, /agentpay_webhooks_total 1/);
  });
});
