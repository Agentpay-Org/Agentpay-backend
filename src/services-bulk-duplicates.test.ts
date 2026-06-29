import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { servicesStore } from "./store/state.js";

const app = createApp();
let sequence = 0;

function serviceId(prefix = "svc-bulk-dup") {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

beforeEach(() => {
  servicesStore.clear();
});

void describe("POST /api/v1/services/bulk duplicate handling", () => {
  void it("flags later duplicate serviceIds without overwriting the first write", async () => {
    const duplicateId = serviceId("svc-duplicate");
    const otherId = serviceId("svc-unique");

    const res = await request(app)
      .post("/api/v1/services/bulk")
      .send({
        items: [
          { serviceId: duplicateId, priceStroops: 10 },
          { serviceId: duplicateId, priceStroops: 999 },
          { serviceId: otherId, priceStroops: 20 },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body.results, [
      {
        index: 0,
        ok: true,
        serviceId: duplicateId,
        priceStroops: 10,
        created: true,
      },
      {
        index: 1,
        ok: false,
        serviceId: duplicateId,
        error: "duplicate_in_batch",
      },
      {
        index: 2,
        ok: true,
        serviceId: otherId,
        priceStroops: 20,
        created: true,
      },
    ]);
    assert.deepStrictEqual(servicesStore.get(duplicateId), { priceStroops: 10 });
    assert.deepStrictEqual(servicesStore.get(otherId), { priceStroops: 20 });
  });

  void it("computes created against store state before the batch starts", async () => {
    const existingId = serviceId("svc-existing");
    const newId = serviceId("svc-new");
    servicesStore.set(existingId, { priceStroops: 1 });

    const res = await request(app)
      .post("/api/v1/services/bulk")
      .send({
        items: [
          { serviceId: existingId, priceStroops: 50 },
          { serviceId: newId, priceStroops: 75 },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.results[0].created, false);
    assert.strictEqual(res.body.results[1].created, true);
    assert.deepStrictEqual(servicesStore.get(existingId), { priceStroops: 50 });
    assert.deepStrictEqual(servicesStore.get(newId), { priceStroops: 75 });
  });

  void it("flags every later duplicate when an id appears more than twice", async () => {
    const id = serviceId("svc-triplicate");

    const res = await request(app)
      .post("/api/v1/services/bulk")
      .send({
        items: [
          { serviceId: id, priceStroops: 1 },
          { serviceId: id, priceStroops: 2 },
          { serviceId: id, priceStroops: 3 },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.results[0].ok, true);
    assert.deepStrictEqual(res.body.results.slice(1), [
      { index: 1, ok: false, serviceId: id, error: "duplicate_in_batch" },
      { index: 2, ok: false, serviceId: id, error: "duplicate_in_batch" },
    ]);
    assert.deepStrictEqual(servicesStore.get(id), { priceStroops: 1 });
  });

  void it("keeps invalid-item validation independent from duplicate detection", async () => {
    const id = serviceId("svc-mixed");

    const res = await request(app)
      .post("/api/v1/services/bulk")
      .send({
        items: [
          { serviceId: id, priceStroops: 5 },
          { serviceId: "", priceStroops: 9 },
          { serviceId: id, priceStroops: 10 },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body.results, [
      { index: 0, ok: true, serviceId: id, priceStroops: 5, created: true },
      { index: 1, ok: false, error: "invalid_item" },
      { index: 2, ok: false, serviceId: id, error: "duplicate_in_batch" },
    ]);
    assert.deepStrictEqual(servicesStore.get(id), { priceStroops: 5 });
  });
});
