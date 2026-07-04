import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { eventLog } from "./events.js";
import { createApp } from "./index.js";
import {
  pauseState,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageKey,
  usageStore,
} from "./store/state.js";

function assertInvalidRequest(body: unknown): void {
  if (body === null || typeof body !== "object") {
    throw new TypeError("expected error response object");
  }
  const record = body as Record<string, unknown>;
  assert.strictEqual(record.error, "invalid_request");
  assert.strictEqual(typeof record.message, "string");
  assert.ok((record.message as string).length > 0);
  assert.strictEqual(typeof record.requestId, "string");
  assert.ok((record.requestId as string).length > 0);
}

beforeEach(() => {
  pauseState.paused = false;
  usageStore.clear();
  servicesStore.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  eventLog.length = 0;
});

void describe("usage recording endpoints", () => {
  void it("records, accumulates, reads back totals, and returns zero for unseen pairs", async () => {
    const app = createApp();

    const first = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-ledger", serviceId: "svc-meter", requests: 40 });
    assert.strictEqual(first.status, 201);
    assert.deepStrictEqual(first.body, {
      agent: "agent-ledger",
      serviceId: "svc-meter",
      total: 40,
    });

    const second = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-ledger", serviceId: "svc-meter", requests: 25 });
    assert.strictEqual(second.status, 201);
    assert.strictEqual(second.body.total, 65);

    const readBack = await request(app).get("/api/v1/usage/agent-ledger/svc-meter");
    assert.strictEqual(readBack.status, 200);
    assert.deepStrictEqual(readBack.body, {
      agent: "agent-ledger",
      serviceId: "svc-meter",
      total: 65,
    });

    const unseen = await request(app).get("/api/v1/usage/agent-ledger/never-used");
    assert.strictEqual(unseen.status, 200);
    assert.deepStrictEqual(unseen.body, {
      agent: "agent-ledger",
      serviceId: "never-used",
      total: 0,
    });
  });

  void it("saturates deterministic totals at Number.MAX_SAFE_INTEGER", async () => {
    const app = createApp();
    usageStore.set(usageKey("agent-max", "svc-max"), Number.MAX_SAFE_INTEGER - 2);

    const response = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-max", serviceId: "svc-max", requests: 10 });

    assert.strictEqual(response.status, 201);
    assert.strictEqual(response.body.total, Number.MAX_SAFE_INTEGER);
    assert.strictEqual(
      usageStore.get(usageKey("agent-max", "svc-max")),
      Number.MAX_SAFE_INTEGER
    );
  });

  void it("refuses disabled services without increasing the usage total", async () => {
    const app = createApp();

    await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-disabled", priceStroops: 10 });
    const initial = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-disabled", serviceId: "svc-disabled", requests: 3 });
    assert.strictEqual(initial.status, 201);

    await request(app)
      .patch("/api/v1/services/svc-disabled/disabled")
      .send({ disabled: true });
    const blocked = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-disabled", serviceId: "svc-disabled", requests: 4 });

    assert.strictEqual(blocked.status, 409);
    assert.strictEqual(blocked.body.error, "service_disabled");
    assert.strictEqual(typeof blocked.body.requestId, "string");
    assert.strictEqual(usageStore.get(usageKey("agent-disabled", "svc-disabled")), 3);
  });

  for (const [label, payload] of [
    ["missing agent", { serviceId: "svc", requests: 1 }],
    ["non-string agent", { agent: 7, serviceId: "svc", requests: 1 }],
    ["empty agent", { agent: "", serviceId: "svc", requests: 1 }],
    ["oversized agent", { agent: "a".repeat(257), serviceId: "svc", requests: 1 }],
    ["missing serviceId", { agent: "agent", requests: 1 }],
    ["non-string serviceId", { agent: "agent", serviceId: 8, requests: 1 }],
    ["empty serviceId", { agent: "agent", serviceId: "", requests: 1 }],
    [
      "oversized serviceId",
      { agent: "agent", serviceId: "s".repeat(129), requests: 1 },
    ],
    ["missing requests", { agent: "agent", serviceId: "svc" }],
    ["zero requests", { agent: "agent", serviceId: "svc", requests: 0 }],
    ["negative requests", { agent: "agent", serviceId: "svc", requests: -2 }],
    ["fractional requests", { agent: "agent", serviceId: "svc", requests: 1.5 }],
    ["non-number requests", { agent: "agent", serviceId: "svc", requests: "1" }],
  ] as const) {
    void it(`rejects ${label} with standard invalid_request shape`, async () => {
      const app = createApp();

      const response = await request(app).post("/api/v1/usage").send(payload);

      assert.strictEqual(response.status, 400);
      assertInvalidRequest(response.body as unknown);
    });
  }
});
