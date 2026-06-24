import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
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

void describe("usage recording endpoints", () => {
  void it("records first usage, accumulates repeats, and reads totals", async () => {
    const app = createApp();

    const first = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-meter", serviceId: "svc-meter", requests: 40 });

    assert.strictEqual(first.status, 201);
    assert.deepStrictEqual(first.body, {
      agent: "agent-meter",
      serviceId: "svc-meter",
      total: 40,
    });

    const second = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-meter", serviceId: "svc-meter", requests: 25 });

    assert.strictEqual(second.status, 201);
    assert.deepStrictEqual(second.body, {
      agent: "agent-meter",
      serviceId: "svc-meter",
      total: 65,
    });

    const accumulated = await request(app).get("/api/v1/usage/agent-meter/svc-meter");

    assert.strictEqual(accumulated.status, 200);
    assert.deepStrictEqual(accumulated.body, {
      agent: "agent-meter",
      serviceId: "svc-meter",
      total: 65,
    });

    const unseen = await request(app).get("/api/v1/usage/unknown-agent/unknown-svc");

    assert.strictEqual(unseen.status, 200);
    assert.deepStrictEqual(unseen.body, {
      agent: "unknown-agent",
      serviceId: "unknown-svc",
      total: 0,
    });
  });

  void it("returns the standard invalid_request shape for validation failures", async () => {
    const app = createApp();
    const cases: { label: string; payload: Record<string, unknown> }[] = [
      {
        label: "missing agent",
        payload: { serviceId: "svc-valid", requests: 1 },
      },
      {
        label: "empty agent",
        payload: { agent: "", serviceId: "svc-valid", requests: 1 },
      },
      {
        label: "oversized agent",
        payload: { agent: "a".repeat(257), serviceId: "svc-valid", requests: 1 },
      },
      {
        label: "missing serviceId",
        payload: { agent: "agent-valid", requests: 1 },
      },
      {
        label: "empty serviceId",
        payload: { agent: "agent-valid", serviceId: "", requests: 1 },
      },
      {
        label: "oversized serviceId",
        payload: { agent: "agent-valid", serviceId: "s".repeat(129), requests: 1 },
      },
      {
        label: "zero requests",
        payload: { agent: "agent-valid", serviceId: "svc-valid", requests: 0 },
      },
      {
        label: "negative requests",
        payload: { agent: "agent-valid", serviceId: "svc-valid", requests: -1 },
      },
      {
        label: "float requests",
        payload: { agent: "agent-valid", serviceId: "svc-valid", requests: 1.5 },
      },
      {
        label: "wrong-type requests",
        payload: { agent: "agent-valid", serviceId: "svc-valid", requests: "1" },
      },
    ];

    for (const { label, payload } of cases) {
      const requestId = `usage-validation-${label.replace(/[^a-z]/g, "-")}`;
      const res = await request(app)
        .post("/api/v1/usage")
        .set("X-Request-Id", requestId)
        .send(payload);

      assert.strictEqual(res.status, 400, label);
      assert.strictEqual(res.body.error, "invalid_request", label);
      assert.strictEqual(typeof res.body.message, "string", label);
      assert.strictEqual(res.body.requestId, requestId, label);
    }
  });

  void it("refuses to accrue usage for disabled services", async () => {
    const app = createApp();
    const requestId = "usage-disabled-guard";

    const service = await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-disabled-usage", priceStroops: 10 });
    assert.strictEqual(service.status, 201);

    const disabled = await request(app)
      .patch("/api/v1/services/svc-disabled-usage/disabled")
      .send({ disabled: true });
    assert.strictEqual(disabled.status, 200);
    assert.strictEqual(disabled.body.disabled, true);

    const rejected = await request(app)
      .post("/api/v1/usage")
      .set("X-Request-Id", requestId)
      .send({ agent: "agent-disabled", serviceId: "svc-disabled-usage", requests: 5 });

    assert.strictEqual(rejected.status, 409);
    assert.strictEqual(rejected.body.error, "service_disabled");
    assert.strictEqual(rejected.body.requestId, requestId);

    const total = await request(app).get(
      "/api/v1/usage/agent-disabled/svc-disabled-usage"
    );

    assert.strictEqual(total.status, 200);
    assert.strictEqual(total.body.total, 0);
  });

  void it("saturates usage totals at Number.MAX_SAFE_INTEGER", async () => {
    const app = createApp();
    const agent = "agent-saturation";
    const serviceId = "svc-saturation";
    const nearMaximum = Number.MAX_SAFE_INTEGER - 2;

    usageStore.set(usageKey(agent, serviceId), nearMaximum);

    const res = await request(app)
      .post("/api/v1/usage")
      .send({ agent, serviceId, requests: 10 });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.total, Number.MAX_SAFE_INTEGER);
    assert.strictEqual(usageStore.get(usageKey(agent, serviceId)), Number.MAX_SAFE_INTEGER);

    const fetched = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);

    assert.strictEqual(fetched.status, 200);
    assert.strictEqual(fetched.body.total, Number.MAX_SAFE_INTEGER);
  });
});
