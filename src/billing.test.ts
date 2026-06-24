import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { eventLog } from "./events.js";
import { createApp } from "./index.js";
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

beforeEach(resetState);

void describe("billing and settlement endpoints", () => {
  void it("quotes registered, zero-price, and unregistered services", async () => {
    const app = createApp();
    servicesStore.set("svc-priced", { priceStroops: 25 });
    servicesStore.set("svc-free", { priceStroops: 0 });
    usageStore.set(usageKey("agent-billing", "svc-priced"), 8);
    usageStore.set(usageKey("agent-billing", "svc-free"), 9);
    usageStore.set(usageKey("agent-billing", "svc-unregistered"), 7);

    const priced = await request(app).get("/api/v1/billing/agent-billing/svc-priced");
    assert.strictEqual(priced.status, 200);
    assert.deepStrictEqual(priced.body, {
      agent: "agent-billing",
      serviceId: "svc-priced",
      requests: 8,
      priceStroops: 25,
      billedStroops: 200,
    });

    const free = await request(app).get("/api/v1/billing/agent-billing/svc-free");
    assert.strictEqual(free.status, 200);
    assert.deepStrictEqual(free.body, {
      agent: "agent-billing",
      serviceId: "svc-free",
      requests: 9,
      priceStroops: 0,
      billedStroops: 0,
    });

    const unregistered = await request(app).get(
      "/api/v1/billing/agent-billing/svc-unregistered"
    );
    assert.strictEqual(unregistered.status, 200);
    assert.deepStrictEqual(unregistered.body, {
      agent: "agent-billing",
      serviceId: "svc-unregistered",
      requests: 7,
      priceStroops: 0,
      billedStroops: 0,
    });
  });

  void it("sums billing totals across multiple agents and services", async () => {
    const app = createApp();
    servicesStore.set("svc-alpha", { priceStroops: 10 });
    servicesStore.set("svc-beta", { priceStroops: 3 });
    servicesStore.set("svc-large", { priceStroops: 2 });
    usageStore.set(usageKey("agent-a", "svc-alpha"), 2);
    usageStore.set(usageKey("agent-b", "svc-alpha"), 4);
    usageStore.set(usageKey("agent-c", "svc-beta"), 5);
    usageStore.set(usageKey("agent-d", "svc-large"), 100_000);
    usageStore.set(usageKey("agent-e", "svc-missing"), 99);

    const total = await request(app).get("/api/v1/billing/total");

    assert.strictEqual(total.status, 200);
    assert.strictEqual(total.body.totalStroops, 200_075);
  });

  void it("settles a pair, drains the accumulator, and emits a usage.settled event", async () => {
    const app = createApp();
    servicesStore.set("svc-settle", { priceStroops: 50 });

    const usage = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-settle", serviceId: "svc-settle", requests: 6 });
    assert.strictEqual(usage.status, 201);

    const settle = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-settle", serviceId: "svc-settle" });

    assert.strictEqual(settle.status, 200);
    assert.deepStrictEqual(settle.body, {
      agent: "agent-settle",
      serviceId: "svc-settle",
      requests: 6,
      priceStroops: 50,
      billedStroops: 300,
    });

    const drained = await request(app).get("/api/v1/usage/agent-settle/svc-settle");
    assert.strictEqual(drained.status, 200);
    assert.strictEqual(drained.body.total, 0);

    const events = await request(app).get("/api/v1/events?type=usage.settled");
    assert.strictEqual(events.status, 200);
    assert.strictEqual(events.body.items.length, 1);
    assert.strictEqual(events.body.items[0].type, "usage.settled");
    assert.deepStrictEqual(events.body.items[0].payload, {
      agent: "agent-settle",
      serviceId: "svc-settle",
      requests: 6,
      billedStroops: 300,
    });
  });

  void it("bills zero on a second settle after the first drain", async () => {
    const app = createApp();
    servicesStore.set("svc-double", { priceStroops: 12 });
    usageStore.set(usageKey("agent-double", "svc-double"), 4);

    const first = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-double", serviceId: "svc-double" });
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.billedStroops, 48);

    const second = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-double", serviceId: "svc-double" });
    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.body.requests, 0);
    assert.strictEqual(second.body.billedStroops, 0);
  });

  void it("rejects missing and invalid settle identifiers with requestId", async () => {
    const app = createApp();
    const cases: { label: string; payload: Record<string, unknown> }[] = [
      { label: "missing agent", payload: { serviceId: "svc-invalid" } },
      { label: "missing serviceId", payload: { agent: "agent-invalid" } },
      {
        label: "non-string agent",
        payload: { agent: 42, serviceId: "svc-invalid" },
      },
      {
        label: "non-string serviceId",
        payload: { agent: "agent-invalid", serviceId: 42 },
      },
    ];

    for (const { label, payload } of cases) {
      const requestId = `settle-validation-${label.replace(/[^a-z]/g, "-")}`;
      const res = await request(app)
        .post("/api/v1/settle")
        .set("X-Request-Id", requestId)
        .send(payload);

      assert.strictEqual(res.status, 400, label);
      assert.strictEqual(res.body.error, "invalid_request", label);
      assert.strictEqual(res.body.requestId, requestId, label);
      assert.strictEqual(typeof res.body.message, "string", label);
    }
  });

  void it("does not settle or drain while the backend is paused", async () => {
    const app = createApp();
    servicesStore.set("svc-paused", { priceStroops: 20 });
    usageStore.set(usageKey("agent-paused", "svc-paused"), 3);

    const paused = await request(app).post("/api/v1/admin/pause");
    assert.strictEqual(paused.status, 200);
    assert.strictEqual(paused.body.paused, true);

    const blocked = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-paused", serviceId: "svc-paused" });

    assert.strictEqual(blocked.status, 503);
    assert.strictEqual(blocked.body.error, "service_paused");
    assert.strictEqual(usageStore.get(usageKey("agent-paused", "svc-paused")), 3);
  });
});
