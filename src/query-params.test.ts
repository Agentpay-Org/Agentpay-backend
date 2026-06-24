import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { eventLog } from "./events.js";
import { createApp } from "./index.js";
import { parseIntParam } from "./queryParams.js";
import {
  apiKeyStore,
  pauseState,
  rateBuckets,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageKey,
  usageStore,
  webhookStore,
} from "./store/state.js";

function resetState(): void {
  eventLog.length = 0;
  pauseState.paused = false;
  apiKeyStore.clear();
  rateBuckets.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
}

function seedServices(count: number): void {
  for (let i = 0; i < count; i++) {
    servicesStore.set(`svc-${String(i).padStart(4, "0")}`, { priceStroops: i });
  }
}

beforeEach(resetState);

void describe("query parameter parsing", () => {
  void it("parses integers with defaults and clamps unsafe values", () => {
    const bounds = { default: 20, min: 1, max: 100 };

    assert.strictEqual(parseIntParam(undefined, bounds), 20);
    assert.strictEqual(parseIntParam("abc", bounds), 20);
    assert.strictEqual(parseIntParam("Infinity", bounds), 20);
    assert.strictEqual(parseIntParam("-5", bounds), 1);
    assert.strictEqual(parseIntParam("0", bounds), 1);
    assert.strictEqual(parseIntParam("250", bounds), 100);
    assert.strictEqual(parseIntParam("7.9", bounds), 7);
  });

  void it("falls back on non-numeric service limits instead of returning an empty list", async () => {
    const app = createApp();
    seedServices(3);

    const res = await request(app).get("/api/v1/services?limit=abc");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.services.length, 3);
  });

  void it("clamps service list limits to min and max bounds", async () => {
    const app = createApp();
    seedServices(1_005);

    const min = await request(app).get("/api/v1/services?limit=0");
    assert.strictEqual(min.status, 200);
    assert.strictEqual(min.body.services.length, 1);

    const max = await request(app).get("/api/v1/services?limit=99999");
    assert.strictEqual(max.status, 200);
    assert.strictEqual(max.body.services.length, 1000);
  });

  void it("clamps agent list and service top-agent limits", async () => {
    const app = createApp();
    for (let i = 0; i < 105; i++) {
      const agent = `agent-${String(i).padStart(3, "0")}`;
      usageStore.set(usageKey(agent, "svc-shared"), i + 1);
    }

    const agentsMin = await request(app).get("/api/v1/agents?limit=-10");
    assert.strictEqual(agentsMin.status, 200);
    assert.strictEqual(agentsMin.body.agents.length, 1);

    const agentsFloat = await request(app).get("/api/v1/agents?limit=2.9");
    assert.strictEqual(agentsFloat.status, 200);
    assert.strictEqual(agentsFloat.body.agents.length, 2);

    const topMax = await request(app).get(
      "/api/v1/services/svc-shared/agents/top?limit=999"
    );
    assert.strictEqual(topMax.status, 200);
    assert.strictEqual(topMax.body.items.length, 100);
  });

  void it("falls back when event limit or since parameters are non-numeric", async () => {
    const app = createApp();
    eventLog.push(
      { id: "evt-1", ts: 100, type: "usage.recorded", payload: { n: 1 } },
      { id: "evt-2", ts: 200, type: "usage.settled", payload: { n: 2 } }
    );

    const badSince = await request(app).get("/api/v1/events?since=abc");
    assert.strictEqual(badSince.status, 200);
    assert.deepStrictEqual(
      badSince.body.items.map((item: { id: string }) => item.id),
      ["evt-1", "evt-2"]
    );

    const minLimit = await request(app).get("/api/v1/events?limit=0");
    assert.strictEqual(minLimit.status, 200);
    assert.strictEqual(minLimit.body.items.length, 1);

    const badLimit = await request(app).get("/api/v1/events?limit=abc");
    assert.strictEqual(badLimit.status, 200);
    assert.strictEqual(badLimit.body.items.length, 2);
  });
});
