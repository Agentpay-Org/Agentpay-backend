import { beforeEach, describe, it } from "node:test";
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

void describe("agents endpoint coverage", () => {
  void it("returns stable list, total, and usage results on repeated reads", async () => {
    usageStore.set(usageKey("agent-alpha", "svc-a"), 3);
    usageStore.set(usageKey("agent-alpha", "svc-b"), 4);
    usageStore.set(usageKey("agent-beta", "svc-a"), 2);

    const app = createApp();

    const firstList = await request(app).get("/api/v1/agents");
    const secondList = await request(app).get("/api/v1/agents");

    assert.strictEqual(firstList.status, 200);
    assert.strictEqual(secondList.status, 200);
    assert.deepStrictEqual(firstList.body, secondList.body);
    assert.deepStrictEqual(firstList.body.agents, ["agent-alpha", "agent-beta"]);

    const firstTotal = await request(app).get("/api/v1/agents/agent-alpha/total");
    const secondTotal = await request(app).get("/api/v1/agents/agent-alpha/total");
    assert.strictEqual(firstTotal.status, 200);
    assert.deepStrictEqual(firstTotal.body, secondTotal.body);
    assert.deepStrictEqual(firstTotal.body, {
      agent: "agent-alpha",
      total: 7,
    });

    const firstUsage = await request(app).get("/api/v1/agents/agent-alpha/usage");
    const secondUsage = await request(app).get("/api/v1/agents/agent-alpha/usage");
    assert.strictEqual(firstUsage.status, 200);
    assert.deepStrictEqual(firstUsage.body, secondUsage.body);
    assert.deepStrictEqual(firstUsage.body, {
      agent: "agent-alpha",
      items: [
        { serviceId: "svc-a", total: 3 },
        { serviceId: "svc-b", total: 4 },
      ],
    });
  });

  void it("returns zero and empty items for unseen agents", async () => {
    const app = createApp();

    const total = await request(app).get("/api/v1/agents/agent-missing/total");
    const usage = await request(app).get("/api/v1/agents/agent-missing/usage");

    assert.strictEqual(total.status, 200);
    assert.deepStrictEqual(total.body, {
      agent: "agent-missing",
      total: 0,
    });
    assert.strictEqual(usage.status, 200);
    assert.deepStrictEqual(usage.body, {
      agent: "agent-missing",
      items: [],
    });
  });

  void it("rejects invalid agent identifiers with a structured 400", async () => {
    const app = createApp();

    const total = await request(app).get("/api/v1/agents/bad::agent/total");
    const usage = await request(app).get("/api/v1/agents/bad::agent/usage");

    assert.strictEqual(total.status, 400);
    assert.strictEqual(total.body.error, "invalid_request");
    assert.strictEqual(total.body.message, "agent and serviceId must be safe identifiers");
    assert.strictEqual(typeof total.body.requestId, "string");

    assert.strictEqual(usage.status, 400);
    assert.strictEqual(usage.body.error, "invalid_request");
    assert.strictEqual(usage.body.message, "agent and serviceId must be safe identifiers");
    assert.strictEqual(typeof usage.body.requestId, "string");
  });
});
