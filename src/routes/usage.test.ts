import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { createUsageRouter } from "./usage.js";
import { servicesDisabled, servicesStore, usageStore } from "../store/state.js";

function createIsolatedUsageApp() {
  const app = express();
  app.use(express.json());
  app.use(createUsageRouter());
  return app;
}

beforeEach(() => {
  usageStore.clear();
  servicesStore.clear();
  servicesDisabled.clear();
});

void describe("usage router", () => {
  void it("can be tested in isolation and accumulates usage totals", async () => {
    const app = createIsolatedUsageApp();

    const created = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-router", serviceId: "svc-router", requests: 2 });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.total, 2);

    const updated = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-router", serviceId: "svc-router", requests: 3 });
    assert.strictEqual(updated.status, 201);
    assert.strictEqual(updated.body.total, 5);

    const fetched = await request(app).get("/api/v1/usage/agent-router/svc-router");
    assert.deepStrictEqual(fetched.body, {
      agent: "agent-router",
      serviceId: "svc-router",
      total: 5,
    });
  });

  void it("uses shared service state when quoting billing", async () => {
    const app = createIsolatedUsageApp();
    servicesStore.set("svc-priced", { priceStroops: 25 });

    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-bill", serviceId: "svc-priced", requests: 4 });

    const quote = await request(app).get("/api/v1/billing/agent-bill/svc-priced");
    assert.strictEqual(quote.status, 200);
    assert.strictEqual(quote.body.requests, 4);
    assert.strictEqual(quote.body.priceStroops, 25);
    assert.strictEqual(quote.body.billedStroops, "100");
  });

  void it("covers bulk usage, exports, agent rollups, settlement, and disabled services", async () => {
    const app = createIsolatedUsageApp();
    servicesStore.set("svc-bulk", { priceStroops: 10 });

    const invalidBulk = await request(app)
      .post("/api/v1/usage/bulk")
      .send({ items: [] });
    assert.strictEqual(invalidBulk.status, 400);

    const bulk = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "agent-bulk", serviceId: "svc-bulk", requests: 2 },
          { agent: "agent-bulk", serviceId: "svc-bulk", requests: 3 },
          { agent: "agent-bulk", serviceId: "svc-bulk", requests: 0 },
        ],
      });
    assert.strictEqual(bulk.status, 201);
    assert.deepStrictEqual(
      bulk.body.results.map((r: { ok: boolean }) => r.ok),
      [true, true, false]
    );

    const jsonExport = await request(app).get("/api/v1/usage/export.json");
    assert.strictEqual(jsonExport.status, 200);
    assert.strictEqual(jsonExport.body.items[0].total, 5);

    const billingTotal = await request(app).get("/api/v1/billing/total");
    assert.strictEqual(billingTotal.status, 200);
    assert.strictEqual(billingTotal.body.totalStroops, "50");

    const agents = await request(app).get("/api/v1/agents");
    assert.strictEqual(agents.status, 200);
    assert.deepStrictEqual(agents.body.agents, ["agent-bulk"]);

    const agentTotal = await request(app).get("/api/v1/agents/agent-bulk/total");
    assert.strictEqual(agentTotal.body.total, 5);

    const agentUsage = await request(app).get("/api/v1/agents/agent-bulk/usage");
    assert.deepStrictEqual(agentUsage.body.items, [
      { serviceId: "svc-bulk", total: 5 },
    ]);

    const invalidSettle = await request(app).post("/api/v1/settle").send({ agent: 1 });
    assert.strictEqual(invalidSettle.status, 400);

    const settled = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-bulk", serviceId: "svc-bulk" });
    assert.strictEqual(settled.status, 200);
    assert.strictEqual(settled.body.billedStroops, "50");

    servicesDisabled.add("svc-disabled");
    const disabled = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-bulk", serviceId: "svc-disabled", requests: 1 });
    assert.strictEqual(disabled.status, 409);
  });
});
