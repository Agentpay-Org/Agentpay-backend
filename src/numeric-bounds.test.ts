import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { MAX_PRICE_STROOPS, MAX_REQUESTS_PER_CALL } from "./numericLimits.js";
import { servicesStore, usageKey, usageStore } from "./store/state.js";

const app = createApp();

beforeEach(() => {
  usageStore.clear();
  servicesStore.clear();
});

void describe("numeric request body bounds", () => {
  void it("rejects over-max usage requests without mutating counters", async () => {
    const res = await request(app)
      .post("/api/v1/usage")
      .send({
        agent: "agent-bounds",
        serviceId: "svc-bounds",
        requests: MAX_REQUESTS_PER_CALL + 1,
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.strictEqual(usageStore.has(usageKey("agent-bounds", "svc-bounds")), false);
  });

  void it("accepts the documented maximum usage request count", async () => {
    const res = await request(app).post("/api/v1/usage").send({
      agent: "agent-bounds",
      serviceId: "svc-bounds",
      requests: MAX_REQUESTS_PER_CALL,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.total, MAX_REQUESTS_PER_CALL);
  });

  void it("marks over-max bulk usage items invalid while keeping valid items", async () => {
    const res = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          {
            agent: "agent-bulk",
            serviceId: "svc-bulk",
            requests: MAX_REQUESTS_PER_CALL,
          },
          {
            agent: "agent-bulk",
            serviceId: "svc-bulk",
            requests: MAX_REQUESTS_PER_CALL + 1,
          },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body.results, [
      { index: 0, ok: true, total: MAX_REQUESTS_PER_CALL },
      { index: 1, ok: false, error: "invalid_item" },
    ]);
    assert.strictEqual(
      usageStore.get(usageKey("agent-bulk", "svc-bulk")),
      MAX_REQUESTS_PER_CALL
    );
  });

  void it("rejects over-max service prices without registering the service", async () => {
    const res = await request(app)
      .post("/api/v1/services")
      .send({
        serviceId: "svc-price-too-large",
        priceStroops: MAX_PRICE_STROOPS + 1,
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.strictEqual(servicesStore.has("svc-price-too-large"), false);
  });

  void it("accepts the documented maximum service price", async () => {
    const res = await request(app).post("/api/v1/services").send({
      serviceId: "svc-price-max",
      priceStroops: MAX_PRICE_STROOPS,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.priceStroops, MAX_PRICE_STROOPS);
  });

  void it("marks over-max bulk service prices invalid while keeping valid items", async () => {
    const res = await request(app)
      .post("/api/v1/services/bulk")
      .send({
        items: [
          { serviceId: "svc-price-good", priceStroops: MAX_PRICE_STROOPS },
          { serviceId: "svc-price-bad", priceStroops: MAX_PRICE_STROOPS + 1 },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body.results, [
      {
        index: 0,
        ok: true,
        serviceId: "svc-price-good",
        priceStroops: MAX_PRICE_STROOPS,
        created: true,
      },
      { index: 1, ok: false, error: "invalid_item" },
    ]);
    assert.strictEqual(servicesStore.has("svc-price-good"), true);
    assert.strictEqual(servicesStore.has("svc-price-bad"), false);
  });

  void it("rejects over-max price patches without changing the old price", async () => {
    servicesStore.set("svc-patch-price", { priceStroops: 10 });

    const res = await request(app)
      .patch("/api/v1/services/svc-patch-price/price")
      .send({ priceStroops: MAX_PRICE_STROOPS + 1 });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.deepStrictEqual(servicesStore.get("svc-patch-price"), {
      priceStroops: 10,
    });
  });
});
