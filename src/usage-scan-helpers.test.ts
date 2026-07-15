import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { eventLog } from "./events.js";
import {
  apiKeyStore,
  config,
  pauseState,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageKey,
  usageStore,
  webhookStore,
} from "./store/state.js";
import {
  parseUsageKey,
  scanByAgent,
  scanByService,
  scanUsageStore,
} from "./usageScan.js";

const defaultConfig = {
  rateLimitPerWindow: 60,
  rateLimitWindowMs: 60_000,
  bulkMaxItems: 100,
  eventLogCap: 10_000,
};

beforeEach(() => {
  apiKeyStore.clear();
  eventLog.length = 0;
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  pauseState.paused = false;
  Object.assign(config, defaultConfig);
});

void describe("usage scan helpers", () => {
  void it("parses usage keys and scans by agent or service", () => {
    usageStore.set(usageKey("agent-a", "svc-one"), 3);
    usageStore.set(usageKey("agent-a", "svc-two"), 4);
    usageStore.set(usageKey("agent-b", "svc-one"), 2);

    assert.deepStrictEqual(parseUsageKey("agent-a::svc-one"), {
      agent: "agent-a",
      serviceId: "svc-one",
    });

    assert.deepStrictEqual(scanUsageStore(), [
      { agent: "agent-a", serviceId: "svc-one", total: 3 },
      { agent: "agent-a", serviceId: "svc-two", total: 4 },
      { agent: "agent-b", serviceId: "svc-one", total: 2 },
    ]);
    assert.deepStrictEqual(scanByAgent("agent-a"), [
      { agent: "agent-a", serviceId: "svc-one", total: 3 },
      { agent: "agent-a", serviceId: "svc-two", total: 4 },
    ]);
    assert.deepStrictEqual(scanByService("svc-one"), [
      { agent: "agent-a", serviceId: "svc-one", total: 3 },
      { agent: "agent-b", serviceId: "svc-one", total: 2 },
    ]);
  });

  void it("preserves usage, service, billing, export, and stats rollups", async () => {
    const app = createApp();
    servicesStore.set("svc-one", { priceStroops: 2 });
    servicesStore.set("svc-two", { priceStroops: 5 });
    usageStore.set(usageKey("agent-a", "svc-one"), 3);
    usageStore.set(usageKey("agent-a", "svc-two"), 4);
    usageStore.set(usageKey("agent-b", "svc-one"), 2);

    const exported = await request(app).get("/api/v1/usage/export.json");
    assert.strictEqual(exported.status, 200);
    assert.deepStrictEqual(exported.body.items, [
      { agent: "agent-a", serviceId: "svc-one", total: 3 },
      { agent: "agent-a", serviceId: "svc-two", total: 4 },
      { agent: "agent-b", serviceId: "svc-one", total: 2 },
    ]);

    const agents = await request(app).get("/api/v1/agents");
    assert.strictEqual(agents.status, 200);
    assert.deepStrictEqual(agents.body.agents, ["agent-a", "agent-b"]);

    const agentTotal = await request(app).get("/api/v1/agents/agent-a/total");
    assert.strictEqual(agentTotal.status, 200);
    assert.strictEqual(agentTotal.body.total, 7);

    const agentUsage = await request(app).get("/api/v1/agents/agent-a/usage");
    assert.strictEqual(agentUsage.status, 200);
    assert.deepStrictEqual(agentUsage.body.items, [
      { serviceId: "svc-one", total: 3 },
      { serviceId: "svc-two", total: 4 },
    ]);

    const serviceUsage = await request(app).get("/api/v1/services/svc-one/usage");
    assert.strictEqual(serviceUsage.status, 200);
    assert.deepStrictEqual(serviceUsage.body, {
      serviceId: "svc-one",
      total: 5,
      agents: 2,
    });

    const serviceAgents = await request(app).get("/api/v1/services/svc-one/agents");
    assert.strictEqual(serviceAgents.status, 200);
    assert.deepStrictEqual(serviceAgents.body.items, [
      { agent: "agent-a", total: 3 },
      { agent: "agent-b", total: 2 },
    ]);

    const topAgent = await request(app).get(
      "/api/v1/services/svc-one/agents/top?limit=1"
    );
    assert.strictEqual(topAgent.status, 200);
    assert.deepStrictEqual(topAgent.body.items, [{ agent: "agent-a", total: 3 }]);

    const billing = await request(app).get("/api/v1/billing/total");
    assert.strictEqual(billing.status, 200);
    assert.deepStrictEqual(billing.body, {
      totalStroops: 30,
      disabledStroops: 0,
      unpricedRequests: 0,
    });

    const stats = await request(app).get("/api/v1/stats");
    assert.strictEqual(stats.status, 200);
    assert.strictEqual(stats.body.totalRequests, 9);
    assert.strictEqual(stats.body.uniqueAgents, 2);
  });
});
