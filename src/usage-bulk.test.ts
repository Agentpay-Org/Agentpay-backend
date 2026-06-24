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

void describe("bulk usage validation parity", () => {
  void it("keeps valid rows while rejecting disabled and malformed rows per-index", async () => {
    const app = createApp();
    servicesDisabled.add("svc-disabled");

    const res = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "agent-valid", serviceId: "svc-valid", requests: 2 },
          { agent: "agent-disabled", serviceId: "svc-disabled", requests: 5 },
          { agent: "", serviceId: "svc-valid", requests: 1 },
          {
            agent: "a".repeat(257),
            serviceId: "svc-valid",
            requests: 1,
          },
          {
            agent: "agent-too-long-service",
            serviceId: "s".repeat(129),
            requests: 1,
          },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body.results, [
      { index: 0, ok: true, total: 2 },
      { index: 1, ok: false, error: "service_disabled" },
      { index: 2, ok: false, error: "invalid_item" },
      { index: 3, ok: false, error: "invalid_item" },
      { index: 4, ok: false, error: "invalid_item" },
    ]);
    assert.strictEqual(usageStore.get(usageKey("agent-valid", "svc-valid")), 2);
    assert.strictEqual(
      usageStore.has(usageKey("agent-disabled", "svc-disabled")),
      false
    );
  });

  void it("rejects all malformed rows without writing usage", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "", serviceId: "svc", requests: 1 },
          { agent: "agent", serviceId: "", requests: 1 },
          { agent: "agent", serviceId: "svc", requests: 0 },
          { agent: "agent", serviceId: "svc", requests: -1 },
          { agent: "agent", serviceId: "svc", requests: 1.5 },
          { agent: 42, serviceId: "svc", requests: 1 },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(
      res.body.results.map((item: { ok: boolean; error: string }) => ({
        ok: item.ok,
        error: item.error,
      })),
      [
        { ok: false, error: "invalid_item" },
        { ok: false, error: "invalid_item" },
        { ok: false, error: "invalid_item" },
        { ok: false, error: "invalid_item" },
        { ok: false, error: "invalid_item" },
        { ok: false, error: "invalid_item" },
      ]
    );
    assert.strictEqual(usageStore.size, 0);
  });

  void it("accumulates valid rows in order using the shared rules", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "agent-bulk", serviceId: "svc-bulk", requests: 2 },
          { agent: "agent-bulk", serviceId: "svc-bulk", requests: 3 },
          { agent: "agent-other", serviceId: "svc-bulk", requests: 4 },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body.results, [
      { index: 0, ok: true, total: 2 },
      { index: 1, ok: true, total: 5 },
      { index: 2, ok: true, total: 4 },
    ]);

    const readback = await request(app).get("/api/v1/usage/agent-bulk/svc-bulk");
    assert.strictEqual(readback.status, 200);
    assert.strictEqual(readback.body.total, 5);
  });
});
