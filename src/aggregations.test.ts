import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { eventLog } from "./events.js";
import {
  apiKeyStore,
  config,
  pauseState,
  rateBuckets,
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

type UsageExportItem = {
  agent: string;
  serviceId: string;
  total: number;
};

async function recordUsage(
  app: ReturnType<typeof createApp>,
  agent: string,
  serviceId: string,
  requests: number
) {
  const response = await request(app)
    .post("/api/v1/usage")
    .send({ agent, serviceId, requests });
  assert.strictEqual(response.status, 201);
  return response;
}

beforeEach(() => {
  apiKeyStore.clear();
  eventLog.length = 0;
  pauseState.paused = false;
  rateBuckets.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  Object.assign(config, defaultConfig);
});

void describe("usage rollups and exports", () => {
  void it("aggregates usage across agents and services", async () => {
    const app = createApp();

    await recordUsage(app, "agent-alpha", "svc-chat", 4);
    await recordUsage(app, "agent-alpha", "svc-vision", 6);
    await recordUsage(app, "agent-beta", "svc-chat", 10);
    await recordUsage(app, "agent-gamma", "svc-chat", 1);

    const agents = await request(app).get("/api/v1/agents");
    assert.strictEqual(agents.status, 200);
    assert.deepStrictEqual(agents.body.agents, [
      "agent-alpha",
      "agent-beta",
      "agent-gamma",
    ]);

    const alphaTotal = await request(app).get("/api/v1/agents/agent-alpha/total");
    assert.strictEqual(alphaTotal.status, 200);
    assert.deepStrictEqual(alphaTotal.body, { agent: "agent-alpha", total: 10 });

    const alphaUsage = await request(app).get("/api/v1/agents/agent-alpha/usage");
    assert.strictEqual(alphaUsage.status, 200);
    assert.deepStrictEqual(alphaUsage.body, {
      agent: "agent-alpha",
      items: [
        { serviceId: "svc-chat", total: 4 },
        { serviceId: "svc-vision", total: 6 },
      ],
    });

    const unknownAgentTotal = await request(app).get(
      "/api/v1/agents/agent-missing/total"
    );
    assert.strictEqual(unknownAgentTotal.status, 200);
    assert.deepStrictEqual(unknownAgentTotal.body, {
      agent: "agent-missing",
      total: 0,
    });

    const unknownAgentUsage = await request(app).get(
      "/api/v1/agents/agent-missing/usage"
    );
    assert.strictEqual(unknownAgentUsage.status, 200);
    assert.deepStrictEqual(unknownAgentUsage.body, {
      agent: "agent-missing",
      items: [],
    });
  });

  void it("reports service totals, consumers, and top agents with a clamped limit", async () => {
    const app = createApp();

    await recordUsage(app, "agent-low", "svc-rollup", 2);
    await recordUsage(app, "agent-high", "svc-rollup", 9);
    await recordUsage(app, "agent-mid", "svc-rollup", 5);
    await recordUsage(app, "agent-other", "svc-other", 20);
    for (let i = 0; i < 105; i++) {
      await recordUsage(
        app,
        `agent-clamp-${String(i).padStart(3, "0")}`,
        "svc-big",
        i + 1
      );
    }

    const usage = await request(app).get("/api/v1/services/svc-rollup/usage");
    assert.strictEqual(usage.status, 200);
    assert.deepStrictEqual(usage.body, {
      serviceId: "svc-rollup",
      total: 16,
      agents: 3,
    });

    const agents = await request(app).get("/api/v1/services/svc-rollup/agents");
    assert.strictEqual(agents.status, 200);
    assert.deepStrictEqual(agents.body, {
      serviceId: "svc-rollup",
      items: [
        { agent: "agent-low", total: 2 },
        { agent: "agent-high", total: 9 },
        { agent: "agent-mid", total: 5 },
      ],
    });

    const top = await request(app).get(
      "/api/v1/services/svc-rollup/agents/top?limit=2"
    );
    assert.strictEqual(top.status, 200);
    assert.deepStrictEqual(top.body, {
      serviceId: "svc-rollup",
      items: [
        { agent: "agent-high", total: 9 },
        { agent: "agent-mid", total: 5 },
      ],
    });

    const clamped = await request(app).get(
      "/api/v1/services/svc-big/agents/top?limit=1000"
    );
    assert.strictEqual(clamped.status, 200);
    assert.strictEqual(clamped.body.items.length, 100);
    assert.deepStrictEqual(clamped.body.items[0], {
      agent: "agent-clamp-104",
      total: 105,
    });
    assert.deepStrictEqual(clamped.body.items.at(-1), {
      agent: "agent-clamp-005",
      total: 6,
    });

    const emptyService = await request(app).get("/api/v1/services/svc-empty/usage");
    assert.strictEqual(emptyService.status, 200);
    assert.deepStrictEqual(emptyService.body, {
      serviceId: "svc-empty",
      total: 0,
      agents: 0,
    });
  });

  void it("escapes CSV exports and includes every tuple in JSON exports", async () => {
    const app = createApp();

    // CSV-dangerous identifiers are rejected by the write API's identifier
    // validation, so seed the store directly to exercise export escaping.
    usageStore.set(usageKey("agent,comma", 'svc "quote"'), 2);
    usageStore.set(usageKey("agent\nline", "svc-newline"), 3);
    usageStore.set(usageKey("agent-plain", "svc-plain"), 4);

    const csv = await request(app).get("/api/v1/usage/export.csv");
    assert.strictEqual(csv.status, 200);
    assert.match(csv.headers["content-type"], /^text\/csv/);
    assert.strictEqual(csv.text.split("\n")[0], "agent,serviceId,total");
    assert.ok(
      csv.text.includes('"agent,comma","svc ""quote""",2'),
      "expected comma and quote fields to be quoted"
    );
    assert.ok(
      csv.text.includes('"agent\nline",svc-newline,3'),
      "expected newline fields to be quoted"
    );
    assert.ok(csv.text.includes("agent-plain,svc-plain,4"));

    const json = await request(app).get("/api/v1/usage/export.json");
    assert.strictEqual(json.status, 200);
    const jsonBody = json.body as { exportedAt: unknown; items: UsageExportItem[] };
    assert.strictEqual(typeof jsonBody.exportedAt, "number");
    assert.ok(Array.isArray(jsonBody.items));
    const exportedTuples = new Map(
      jsonBody.items.map((item) => [`${item.agent}\u0000${item.serviceId}`, item.total])
    );
    assert.strictEqual(exportedTuples.size, 3);
    assert.strictEqual(exportedTuples.get("agent\nline\u0000svc-newline"), 3);
    assert.strictEqual(exportedTuples.get('agent,comma\u0000svc "quote"'), 2);
    assert.strictEqual(exportedTuples.get("agent-plain\u0000svc-plain"), 4);
  });
});
