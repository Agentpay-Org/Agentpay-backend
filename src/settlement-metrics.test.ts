import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import {
  pauseState,
  servicesDisabled,
  servicesStore,
  settlementCounters,
  usageKey,
  usageStore,
} from "./store/state.js";

const app = createApp();

beforeEach(() => {
  pauseState.paused = false;
  servicesDisabled.clear();
  servicesStore.clear();
  settlementCounters.settledStroopsTotal = 0n;
  settlementCounters.settlementsTotal = 0;
  usageStore.clear();
});

void describe("settlement metrics", () => {
  void it("tracks settlement count and settled stroops across drained settles", async () => {
    servicesStore.set("svc-settle", { priceStroops: 5 });
    usageStore.set(usageKey("agent-a", "svc-settle"), 4);

    const first = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-a", serviceId: "svc-settle" });
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.billedStroops, 20);

    const second = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-a", serviceId: "svc-settle" });
    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.body.billedStroops, 0);

    const metrics = await request(app).get("/api/v1/metrics");
    assert.strictEqual(metrics.status, 200);
    assert.match(metrics.text, /agentpay_settled_stroops_total 20\n/);
    assert.match(metrics.text, /agentpay_settlements_total 2\n/);

    const stats = await request(app).get("/api/v1/stats");
    assert.strictEqual(stats.status, 200);
    assert.strictEqual(stats.body.settledStroopsTotal, "20");
    assert.strictEqual(stats.body.settlementsTotal, 2);
  });

  void it("serializes large settled stroop totals as decimal strings", async () => {
    servicesStore.set("svc-large", { priceStroops: 1_000_000_000_000 });
    usageStore.set(usageKey("agent-big", "svc-large"), 3);

    const settle = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-big", serviceId: "svc-large" });
    assert.strictEqual(settle.status, 200);
    assert.strictEqual(settle.body.billedStroops, 3_000_000_000_000);

    const stats = await request(app).get("/api/v1/stats");
    assert.strictEqual(stats.body.settledStroopsTotal, "3000000000000");

    const metrics = await request(app).get("/api/v1/metrics");
    assert.match(metrics.text, /agentpay_settled_stroops_total 3000000000000\n/);
  });
});
