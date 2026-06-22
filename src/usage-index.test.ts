import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app, assertUsageIndexesConsistent } from "./index.js";

let seq = 0;
const id = (label: string) => `idx-${Date.now()}-${process.pid}-${++seq}-${label}`;

async function createService(serviceId: string, priceStroops: number) {
  const res = await request(app)
    .post("/api/v1/services")
    .send({ serviceId, priceStroops });
  assert.ok(res.status === 201 || res.status === 200);
}

async function recordUsage(agent: string, serviceId: string, requests: number) {
  const res = await request(app)
    .post("/api/v1/usage")
    .send({ agent, serviceId, requests });
  assert.strictEqual(res.status, 201);
  return res.body as { agent: string; serviceId: string; total: number };
}

async function billingTotal() {
  const res = await request(app).get("/api/v1/billing/total");
  assert.strictEqual(res.status, 200);
  return res.body.totalStroops as number;
}

async function statsTotalRequests() {
  const res = await request(app).get("/api/v1/stats");
  assert.strictEqual(res.status, 200);
  return res.body.totalRequests as number;
}

beforeEach(async () => {
  await request(app).post("/api/v1/admin/unpause");
});

void describe("usage rollup indexes", () => {
  void it("serves agent and service rollups from maintained indexes", async () => {
    const agent = id("agent-a");
    const otherAgent = id("agent-b");
    const service = id("service-a");
    const otherService = id("service-b");

    await createService(service, 2);
    await createService(otherService, 5);
    await recordUsage(agent, service, 3);
    await recordUsage(agent, service, 4);
    await recordUsage(agent, otherService, 5);
    await recordUsage(otherAgent, service, 2);

    assertUsageIndexesConsistent();

    const agents = await request(app).get("/api/v1/agents?limit=1000");
    assert.strictEqual(agents.status, 200);
    assert.ok((agents.body.agents as string[]).includes(agent));
    assert.ok((agents.body.agents as string[]).includes(otherAgent));

    const agentTotal = await request(app).get(`/api/v1/agents/${agent}/total`);
    assert.strictEqual(agentTotal.status, 200);
    assert.deepStrictEqual(agentTotal.body, { agent, total: 12 });

    const agentUsage = await request(app).get(`/api/v1/agents/${agent}/usage`);
    assert.strictEqual(agentUsage.status, 200);
    assert.deepStrictEqual(agentUsage.body.items, [
      { serviceId: service, total: 7 },
      { serviceId: otherService, total: 5 },
    ]);

    const serviceUsage = await request(app).get(`/api/v1/services/${service}/usage`);
    assert.strictEqual(serviceUsage.status, 200);
    assert.deepStrictEqual(serviceUsage.body, {
      serviceId: service,
      total: 9,
      agents: 2,
    });

    const serviceAgents = await request(app).get(`/api/v1/services/${service}/agents`);
    assert.strictEqual(serviceAgents.status, 200);
    assert.deepStrictEqual(serviceAgents.body.items, [
      { agent, total: 7 },
      { agent: otherAgent, total: 2 },
    ]);
  });

  void it("keeps bulk indexes and stable top-N tie ordering", async () => {
    const service = id("service-top");
    const first = id("agent-first");
    const second = id("agent-second");
    const third = id("agent-third");

    await createService(service, 1);
    const bulk = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: first, serviceId: service, requests: 5 },
          { agent: second, serviceId: service, requests: 5 },
          { agent: third, serviceId: service, requests: 2 },
        ],
      });
    assert.strictEqual(bulk.status, 201);
    assert.ok(bulk.body.results.every((r: { ok: boolean }) => r.ok));

    assertUsageIndexesConsistent();

    const top = await request(app).get(
      `/api/v1/services/${service}/agents/top?limit=2`
    );
    assert.strictEqual(top.status, 200);
    assert.deepStrictEqual(top.body.items, [
      { agent: first, total: 5 },
      { agent: second, total: 5 },
    ]);
  });

  void it("settle resets usage to zero while keeping indexed keys visible", async () => {
    const agent = id("agent-settle");
    const service = id("service-settle");
    const baselineRequests = await statsTotalRequests();
    const baselineBilling = await billingTotal();

    await createService(service, 7);
    await recordUsage(agent, service, 4);
    assert.strictEqual(await statsTotalRequests(), baselineRequests + 4);
    assert.strictEqual(await billingTotal(), baselineBilling + 28);

    const settle = await request(app)
      .post("/api/v1/settle")
      .send({ agent, serviceId: service });
    assert.strictEqual(settle.status, 200);
    assert.strictEqual(settle.body.requests, 4);
    assert.strictEqual(settle.body.billedStroops, 28);

    assertUsageIndexesConsistent();
    assert.strictEqual(await statsTotalRequests(), baselineRequests);
    assert.strictEqual(await billingTotal(), baselineBilling);

    const agentUsage = await request(app).get(`/api/v1/agents/${agent}/usage`);
    assert.deepStrictEqual(agentUsage.body.items, [{ serviceId: service, total: 0 }]);

    const serviceUsage = await request(app).get(`/api/v1/services/${service}/usage`);
    assert.deepStrictEqual(serviceUsage.body, {
      serviceId: service,
      total: 0,
      agents: 1,
    });
  });

  void it("reprices protocol billing total on service overwrite, patch, and delete", async () => {
    const agent = id("agent-price");
    const service = id("service-price");
    const baselineBilling = await billingTotal();

    await createService(service, 2);
    await recordUsage(agent, service, 10);
    assert.strictEqual(await billingTotal(), baselineBilling + 20);

    const patch = await request(app)
      .patch(`/api/v1/services/${service}/price`)
      .send({ priceStroops: 5 });
    assert.strictEqual(patch.status, 200);
    assert.strictEqual(await billingTotal(), baselineBilling + 50);

    await createService(service, 3);
    assert.strictEqual(await billingTotal(), baselineBilling + 30);

    const del = await request(app).delete(`/api/v1/services/${service}`);
    assert.strictEqual(del.status, 204);
    assert.strictEqual(await billingTotal(), baselineBilling);

    assertUsageIndexesConsistent();
  });
});
