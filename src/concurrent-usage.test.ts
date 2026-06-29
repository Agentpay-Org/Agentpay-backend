import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { eventLog } from "./events.js";
import {
  apiKeyStore,
  pauseState,
  rateBuckets,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
  webhookStore,
} from "./store/state.js";

beforeEach(() => {
  apiKeyStore.clear();
  eventLog.length = 0;
  rateBuckets.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  pauseState.paused = false;
});

void describe("concurrent usage writes", () => {
  void it("accumulates many overlapping single writes to the same usage key", async () => {
    const app = createApp();
    const writes = Array.from({ length: 40 }, (_, index) => (index % 5) + 1);
    const expectedTotal = writes.reduce((sum, requests) => sum + requests, 0);

    const responses = await Promise.all(
      writes.map((requests) =>
        request(app)
          .post("/api/v1/usage")
          .send({ agent: "agent-concurrent", serviceId: "svc-concurrent", requests })
      )
    );

    assert.deepStrictEqual(
      responses.map((res) => res.status),
      Array.from({ length: writes.length }, () => 201)
    );

    const final = await request(app).get(
      "/api/v1/usage/agent-concurrent/svc-concurrent"
    );
    assert.strictEqual(final.status, 200);
    assert.strictEqual(final.body.total, expectedTotal);
  });

  void it("accumulates interleaved bulk and single writes to the same usage key", async () => {
    const app = createApp();
    const singleWrites = [1, 2, 3, 4, 5, 6, 7, 8];
    const bulkWrites = [
      [2, 3, 4],
      [5, 1],
      [6, 2, 2],
      [4, 4, 4],
    ];
    const expectedTotal =
      singleWrites.reduce((sum, requests) => sum + requests, 0) +
      bulkWrites.flat().reduce((sum, requests) => sum + requests, 0);

    const operations = [
      ...singleWrites.map((requests) =>
        request(app)
          .post("/api/v1/usage")
          .send({ agent: "agent-mixed", serviceId: "svc-mixed", requests })
      ),
      ...bulkWrites.map((items) =>
        request(app)
          .post("/api/v1/usage/bulk")
          .send({
            items: items.map((requests) => ({
              agent: "agent-mixed",
              serviceId: "svc-mixed",
              requests,
            })),
          })
      ),
    ];

    const responses = await Promise.all(operations);

    for (const response of responses) {
      assert.strictEqual(response.status, 201);
      if (Array.isArray(response.body.results)) {
        assert.ok(response.body.results.every((result: { ok: boolean }) => result.ok));
      }
    }

    const final = await request(app).get("/api/v1/usage/agent-mixed/svc-mixed");
    assert.strictEqual(final.status, 200);
    assert.strictEqual(final.body.total, expectedTotal);
  });

  void it("keeps distinct usage keys isolated while writes run in parallel", async () => {
    const app = createApp();
    const writes = [
      { agent: "agent-a", serviceId: "svc-1", requests: [1, 2, 3] },
      { agent: "agent-a", serviceId: "svc-2", requests: [4, 5] },
      { agent: "agent-b", serviceId: "svc-1", requests: [6, 7, 8, 9] },
    ];

    await Promise.all(
      writes.flatMap(({ agent, serviceId, requests }) =>
        requests.map((count) =>
          request(app).post("/api/v1/usage").send({ agent, serviceId, requests: count })
        )
      )
    );

    for (const { agent, serviceId, requests } of writes) {
      const expectedTotal = requests.reduce((sum, count) => sum + count, 0);
      const final = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);
      assert.strictEqual(final.status, 200);
      assert.strictEqual(final.body.total, expectedTotal);
    }
  });
});
