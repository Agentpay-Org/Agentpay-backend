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

void describe("BigInt stroops billing responses", () => {
  void it("returns exact decimal-string billedStroops for pair billing", async () => {
    const app = createIsolatedBillingApp();
    servicesStore.set("svc-expensive", { priceStroops: 10_000_000 });
    usageStore.set("agent-big::svc-expensive", Number.MAX_SAFE_INTEGER);

    const res = await request(app).get("/api/v1/billing/agent-big/svc-expensive");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.requests, Number.MAX_SAFE_INTEGER);
    assert.strictEqual(res.body.priceStroops, 10_000_000);
    assert.strictEqual(res.body.billedStroops, "90071992547409910000000");
  });

  void it("returns exact decimal-string billedStroops from settle and drains usage", async () => {
    const app = createIsolatedBillingApp();
    servicesStore.set("svc-settle", { priceStroops: 9_999_999 });
    usageStore.set("agent-settle::svc-settle", Number.MAX_SAFE_INTEGER);

    const res = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-settle", serviceId: "svc-settle" });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.billedStroops, "90071983540210655259009");
    assert.strictEqual(usageStore.get("agent-settle::svc-settle"), 0);
  });

  void it("returns exact decimal-string totals across priced and disabled usage", async () => {
    const app = createIsolatedBillingApp();
    servicesStore.set("svc-enabled", { priceStroops: 10_000_000 });
    servicesStore.set("svc-disabled", { priceStroops: 2 });
    servicesDisabled.add("svc-disabled");
    usageStore.set("agent-a::svc-enabled", Number.MAX_SAFE_INTEGER);
    usageStore.set("agent-b::svc-disabled", Number.MAX_SAFE_INTEGER);
    usageStore.set("agent-c::svc-deleted", 7);

    const res = await request(app).get("/api/v1/billing/total");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      totalStroops: "90072010561808419481982",
      disabledStroops: "18014398509481982",
      unpricedRequests: 7,
    });
  });

  void it("keeps zero-price service billing as a string zero", async () => {
    const app = createIsolatedBillingApp();
    servicesStore.set("svc-free", { priceStroops: 0 });
    usageStore.set("agent-free::svc-free", Number.MAX_SAFE_INTEGER);

    const res = await request(app).get("/api/v1/billing/agent-free/svc-free");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.billedStroops, "0");
  });
});
