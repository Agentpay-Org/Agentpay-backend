import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { createUsageRouter } from "./routes/usage.js";
import { servicesDisabled, servicesStore, usageStore } from "./store/state.js";

function createIsolatedBillingApp() {
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

void describe("billing total breakdown", () => {
  void it("returns zero totals when no usage has been recorded", async () => {
    const app = createIsolatedBillingApp();

    const res = await request(app).get("/api/v1/billing/total");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      totalStroops: 0,
      disabledStroops: 0,
      unpricedRequests: 0,
    });
  });

  void it("keeps totalStroops as the aggregate for priced enabled services", async () => {
    const app = createIsolatedBillingApp();
    servicesStore.set("svc-enabled-a", { priceStroops: 10 });
    servicesStore.set("svc-enabled-b", { priceStroops: 25 });
    usageStore.set("agent-a::svc-enabled-a", 3);
    usageStore.set("agent-b::svc-enabled-b", 4);

    const res = await request(app).get("/api/v1/billing/total");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      totalStroops: 130,
      disabledStroops: 0,
      unpricedRequests: 0,
    });
  });

  void it("surfaces disabled service billing while preserving the total", async () => {
    const app = createIsolatedBillingApp();
    servicesStore.set("svc-enabled", { priceStroops: 7 });
    servicesStore.set("svc-disabled", { priceStroops: 11 });
    servicesDisabled.add("svc-disabled");
    usageStore.set("agent-a::svc-enabled", 5);
    usageStore.set("agent-b::svc-disabled", 6);

    const res = await request(app).get("/api/v1/billing/total");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      totalStroops: 101,
      disabledStroops: 66,
      unpricedRequests: 0,
    });
  });

  void it("counts unregistered service usage as unpriced requests", async () => {
    const app = createIsolatedBillingApp();
    servicesStore.set("svc-priced", { priceStroops: 13 });
    servicesStore.set("svc-disabled", { priceStroops: 2 });
    servicesDisabled.add("svc-disabled");
    usageStore.set("agent-a::svc-priced", 4);
    usageStore.set("agent-b::svc-disabled", 5);
    usageStore.set("agent-c::svc-deleted", 8);

    const res = await request(app).get("/api/v1/billing/total");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      totalStroops: 62,
      disabledStroops: 10,
      unpricedRequests: 8,
    });
  });
});
