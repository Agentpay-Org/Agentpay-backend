import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { createUsageRouter } from "./routes/usage.js";
import {
  servicesDisabled,
  servicesStore,
  usageKey,
  usageStore,
} from "./store/state.js";

function createIsolatedUsageApp() {
  const app = express();
  app.use(express.json());
  app.use(createUsageRouter());
  return app;
}

beforeEach(() => {
  servicesDisabled.clear();
  servicesStore.clear();
  usageStore.clear();
});

void describe("bulk usage validation parity", () => {
  void it("rejects disabled services per item while preserving valid writes", async () => {
    const app = createIsolatedUsageApp();
    servicesDisabled.add("svc-disabled");

    const res = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "agent-ok", serviceId: "svc-active", requests: 2 },
          { agent: "agent-off", serviceId: "svc-disabled", requests: 3 },
          { agent: "agent-ok", serviceId: "svc-active", requests: 4 },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body.results, [
      { index: 0, ok: true, total: 2 },
      { index: 1, ok: false, error: "service_disabled" },
      { index: 2, ok: true, total: 6 },
    ]);
    assert.strictEqual(usageStore.get(usageKey("agent-ok", "svc-active")), 6);
    assert.strictEqual(usageStore.has(usageKey("agent-off", "svc-disabled")), false);
  });

  void it("applies the single usage identifier length caps to each bulk item", async () => {
    const app = createIsolatedUsageApp();
    const overlongAgent = "a".repeat(257);
    const overlongServiceId = "s".repeat(129);

    const res = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "", serviceId: "svc-valid", requests: 1 },
          { agent: overlongAgent, serviceId: "svc-valid", requests: 1 },
          { agent: "agent-valid", serviceId: "", requests: 1 },
          { agent: "agent-valid", serviceId: overlongServiceId, requests: 1 },
          { agent: "agent-valid", serviceId: "svc-valid", requests: 2 },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body.results, [
      { index: 0, ok: false, error: "invalid_item" },
      { index: 1, ok: false, error: "invalid_item" },
      { index: 2, ok: false, error: "invalid_item" },
      { index: 3, ok: false, error: "invalid_item" },
      { index: 4, ok: true, total: 2 },
    ]);
    assert.strictEqual(usageStore.size, 1);
    assert.strictEqual(usageStore.get(usageKey("agent-valid", "svc-valid")), 2);
  });
});
