import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import {
  lifetimeRequests,
  pauseState,
  servicesDisabled,
  servicesStore,
  usageStore,
} from "./store/state.js";

const app = createApp();

beforeEach(() => {
  lifetimeRequests.total = 0;
  pauseState.paused = false;
  servicesDisabled.clear();
  servicesStore.clear();
  usageStore.clear();
});

void describe("lifetime request metrics", () => {
  void it("keeps lifetimeRequests after settlement drains outstanding usage", async () => {
    servicesStore.set("svc-lifetime", { priceStroops: 5 });

    const record = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc-lifetime", requests: 7 });
    assert.strictEqual(record.status, 201);

    const beforeSettleMetrics = await request(app).get("/api/v1/metrics");
    assert.strictEqual(beforeSettleMetrics.status, 200);
    assert.match(beforeSettleMetrics.text, /agentpay_usage_requests_total 7\n/);
    assert.match(
      beforeSettleMetrics.text,
      /# TYPE agentpay_requests_recorded_total counter\nagentpay_requests_recorded_total 7\n/
    );

    const beforeSettleStats = await request(app).get("/api/v1/stats");
    assert.strictEqual(beforeSettleStats.status, 200);
    assert.strictEqual(beforeSettleStats.body.totalRequests, 7);
    assert.strictEqual(beforeSettleStats.body.lifetimeRequests, 7);

    const settle = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-a", serviceId: "svc-lifetime" });
    assert.strictEqual(settle.status, 200);

    const afterSettleMetrics = await request(app).get("/api/v1/metrics");
    assert.strictEqual(afterSettleMetrics.status, 200);
    assert.match(afterSettleMetrics.text, /agentpay_usage_requests_total 0\n/);
    assert.match(afterSettleMetrics.text, /agentpay_requests_recorded_total 7\n/);

    const afterSettleStats = await request(app).get("/api/v1/stats");
    assert.strictEqual(afterSettleStats.status, 200);
    assert.strictEqual(afterSettleStats.body.totalRequests, 0);
    assert.strictEqual(afterSettleStats.body.lifetimeRequests, 7);
  });

  void it("increments lifetimeRequests for each valid bulk usage item", async () => {
    const bulk = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "agent-a", serviceId: "svc-a", requests: 3 },
          { agent: "agent-b", serviceId: "svc-b", requests: 4 },
          { agent: "agent-c", serviceId: "svc-c", requests: 0 },
        ],
      });
    assert.strictEqual(bulk.status, 201);

    const stats = await request(app).get("/api/v1/stats");
    assert.strictEqual(stats.status, 200);
    assert.strictEqual(stats.body.totalRequests, 7);
    assert.strictEqual(stats.body.lifetimeRequests, 7);

    const metrics = await request(app).get("/api/v1/metrics");
    assert.match(metrics.text, /agentpay_requests_recorded_total 7\n/);
  });
});
