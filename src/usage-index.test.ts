import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import {
  assertUsageIndexesConsistent,
  getUsageTotalRequests,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageByAgent,
  usageByService,
  usageStore,
  usageTotalsByAgent,
  usageTotalsByService,
} from "./store/state.js";

beforeEach(() => {
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
});

void describe("usage rollup indexes", () => {
  void it("keeps indexes in sync after add, bulk, settle, overwrite, and clear", async () => {
    const app = createApp();
    servicesStore.set("svc-alpha", { priceStroops: 1 });
    servicesStore.set("svc-beta", { priceStroops: 2 });

    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc-alpha", requests: 3 })
      .expect(201);
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc-beta", requests: 4 })
      .expect(201);
    await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "agent-b", serviceId: "svc-alpha", requests: 5 },
          { agent: "agent-b", serviceId: "svc-beta", requests: 0 },
        ],
      })
      .expect(201);

    assertUsageIndexesConsistent();
    assert.strictEqual(getUsageTotalRequests(), 12);
    assert.strictEqual(usageTotalsByAgent.get("agent-a"), 7);
    assert.strictEqual(usageTotalsByService.get("svc-alpha"), 8);
    assert.deepStrictEqual(Array.from(usageByAgent.keys()), ["agent-a", "agent-b"]);
    assert.deepStrictEqual(Array.from(usageByService.keys()), [
      "svc-alpha",
      "svc-beta",
    ]);

    const stats = await request(app).get("/api/v1/stats").expect(200);
    assert.strictEqual(stats.body.totalRequests, 12);
    assert.strictEqual(stats.body.uniqueAgents, 2);

    const billingTotal = await request(app).get("/api/v1/billing/total").expect(200);
    assert.strictEqual(billingTotal.body.totalStroops, 16);

    const settled = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-a", serviceId: "svc-alpha" })
      .expect(200);
    assert.strictEqual(settled.body.requests, 3);

    assertUsageIndexesConsistent();
    assert.strictEqual(getUsageTotalRequests(), 9);
    assert.strictEqual(usageTotalsByAgent.get("agent-a"), 4);
    assert.strictEqual(usageTotalsByService.get("svc-alpha"), 5);

    usageStore.set("agent-b::svc-alpha", 8);
    assertUsageIndexesConsistent();
    assert.strictEqual(getUsageTotalRequests(), 12);
    assert.strictEqual(usageTotalsByAgent.get("agent-b"), 8);
    assert.strictEqual(usageTotalsByService.get("svc-alpha"), 8);

    usageStore.clear();
    assertUsageIndexesConsistent();
    assert.strictEqual(getUsageTotalRequests(), 0);
    assert.strictEqual(usageByAgent.size, 0);
    assert.strictEqual(usageByService.size, 0);
  });

  void it("serves agent and service rollups from maintained indexes", async () => {
    const app = createApp();

    await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "agent-a", serviceId: "svc-shared", requests: 2 },
          { agent: "agent-b", serviceId: "svc-shared", requests: 7 },
          { agent: "agent-a", serviceId: "svc-other", requests: 4 },
        ],
      })
      .expect(201);

    const agentTotal = await request(app)
      .get("/api/v1/agents/agent-a/total")
      .expect(200);
    assert.strictEqual(agentTotal.body.total, 6);

    const agentUsage = await request(app)
      .get("/api/v1/agents/agent-a/usage")
      .expect(200);
    assert.deepStrictEqual(agentUsage.body.items, [
      { serviceId: "svc-shared", total: 2 },
      { serviceId: "svc-other", total: 4 },
    ]);

    const serviceUsage = await request(app)
      .get("/api/v1/services/svc-shared/usage")
      .expect(200);
    assert.strictEqual(serviceUsage.body.total, 9);
    assert.strictEqual(serviceUsage.body.agents, 2);

    const topAgents = await request(app)
      .get("/api/v1/services/svc-shared/agents/top?limit=1")
      .expect(200);
    assert.deepStrictEqual(topAgents.body.items, [{ agent: "agent-b", total: 7 }]);

    assertUsageIndexesConsistent();
  });
});
