import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { eventLog } from "./events.js";
import { createApp } from "./index.js";
import {
  pauseState,
  servicesDisabled,
  servicesStore,
  usageKey,
  usageStore,
} from "./store/state.js";

const app = createApp();

beforeEach(() => {
  eventLog.length = 0;
  pauseState.paused = false;
  servicesDisabled.clear();
  servicesStore.clear();
  usageStore.clear();
});

void describe("POST /api/v1/settle/bulk", () => {
  void it("drains every outstanding service for one agent and emits events", async () => {
    servicesStore.set("svc-a", { priceStroops: 2 });
    servicesStore.set("svc-b", { priceStroops: 3 });
    servicesDisabled.add("svc-b");
    usageStore.set(usageKey("agent-a", "svc-a"), 4);
    usageStore.set(usageKey("agent-a", "svc-b"), 5);
    usageStore.set(usageKey("agent-a", "svc-unregistered"), 7);
    usageStore.set(usageKey("agent-b", "svc-a"), 6);

    const res = await request(app)
      .post("/api/v1/settle/bulk")
      .send({ agent: "agent-a" });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      agent: "agent-a",
      items: [
        { serviceId: "svc-a", requests: 4, priceStroops: 2, billedStroops: 8 },
        { serviceId: "svc-b", requests: 5, priceStroops: 3, billedStroops: 15 },
        {
          serviceId: "svc-unregistered",
          requests: 7,
          priceStroops: 0,
          billedStroops: 0,
        },
      ],
      totalBilledStroops: 23,
    });
    assert.strictEqual(usageStore.get(usageKey("agent-a", "svc-a")), 0);
    assert.strictEqual(usageStore.get(usageKey("agent-a", "svc-b")), 0);
    assert.strictEqual(usageStore.get(usageKey("agent-a", "svc-unregistered")), 0);
    assert.strictEqual(usageStore.get(usageKey("agent-b", "svc-a")), 6);

    const settledEvents = eventLog.filter((event) => event.type === "usage.settled");
    assert.strictEqual(settledEvents.length, 3);
    assert.deepStrictEqual(
      settledEvents.map((event) => event.payload.serviceId),
      ["svc-a", "svc-b", "svc-unregistered"]
    );
  });

  void it("returns an empty idempotent response for an agent with no usage", async () => {
    const res = await request(app)
      .post("/api/v1/settle/bulk")
      .send({ agent: "agent-empty" });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      agent: "agent-empty",
      items: [],
      totalBilledStroops: 0,
    });
    assert.strictEqual(eventLog.length, 0);
  });

  void it("rejects an invalid agent field with the standard envelope", async () => {
    const res = await request(app).post("/api/v1/settle/bulk").send({ agent: "" });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.ok(res.body.requestId);
  });

  void it("is blocked by the pause guard because it is a write", async () => {
    pauseState.paused = true;

    const res = await request(app)
      .post("/api/v1/settle/bulk")
      .send({ agent: "agent-a" });

    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.error, "service_paused");
  });
});
