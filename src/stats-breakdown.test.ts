import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { servicesStore, usageStore } from "./store/state.js";

beforeEach(() => {
  servicesStore.clear();
  usageStore.clear();
});

void describe("stats services breakdown", () => {
  void it("returns a bounded, cursor-paginated per-service breakdown", async () => {
    const app = createApp();
    for (const [serviceId, priceStroops] of [
      ["svc-a", 10],
      ["svc-b", 20],
      ["svc-c", 30],
    ] as const) {
      const created = await request(app)
        .post("/api/v1/services")
        .send({ serviceId, priceStroops });
      assert.strictEqual(created.status, 201);
    }
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-x", serviceId: "svc-a", requests: 5 });

    const firstPage = await request(app).get("/api/v1/stats?limit=2");
    assert.strictEqual(firstPage.status, 200);
    assert.strictEqual(firstPage.body.servicesBreakdown.length, 2);
    assert.strictEqual(firstPage.body.servicesBreakdownTotal, 3);
    assert.ok(firstPage.body.nextServicesBreakdownCursor);

    const secondPage = await request(app).get(
      `/api/v1/stats?limit=2&cursor=${firstPage.body.nextServicesBreakdownCursor}`
    );
    assert.strictEqual(secondPage.status, 200);
    assert.strictEqual(secondPage.body.servicesBreakdown.length, 1);
    assert.strictEqual(secondPage.body.nextServicesBreakdownCursor, null);

    const svcA = [...firstPage.body.servicesBreakdown, ...secondPage.body.servicesBreakdown].find(
      (entry: { serviceId: string }) => entry.serviceId === "svc-a"
    );
    assert.strictEqual(svcA.priceStroops, 10);
    assert.strictEqual(svcA.requestsOutstanding, 5);
  });

  void it("rejects a malformed servicesBreakdown cursor with 400", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/stats?cursor=not-a-cursor!!");
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
  });

  void it("rejects an unknown query parameter on /api/v1/stats and /api/v1/metrics", async () => {
    const app = createApp();
    const stats = await request(app).get("/api/v1/stats?bogus=1");
    assert.strictEqual(stats.status, 400);
    assert.strictEqual(stats.body.error, "invalid_request");

    const metrics = await request(app).get("/api/v1/metrics?bogus=1");
    assert.strictEqual(metrics.status, 400);
    assert.strictEqual(metrics.body.error, "invalid_request");
  });

  void it("repeats identically for the same query (idempotent)", async () => {
    const app = createApp();
    await request(app).post("/api/v1/services").send({ serviceId: "svc-a", priceStroops: 10 });

    const first = await request(app).get("/api/v1/stats");
    const second = await request(app).get("/api/v1/stats");
    assert.deepStrictEqual(first.body, second.body);
  });
});
