import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";
import {
  isSafeCount,
  isSafePrice,
  MAX_PRICE_STROOPS,
  MAX_REQUESTS_PER_CALL,
} from "./validation.js";

let seq = 0;
const sid = () => `svc-numeric-${Date.now()}-${++seq}`;

beforeEach(async () => {
  await request(app).post("/api/v1/admin/unpause");
});

void describe("numeric request bounds", () => {
  void it("keeps the maximum single billing multiplication within safe integer range", () => {
    assert.ok(MAX_REQUESTS_PER_CALL > 0);
    assert.ok(MAX_PRICE_STROOPS >= 0);
    assert.ok(
      MAX_REQUESTS_PER_CALL * MAX_PRICE_STROOPS <= Number.MAX_SAFE_INTEGER
    );
  });

  void it("rejects NaN, Infinity, floats, and unsafe helper inputs", () => {
    for (const value of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      assert.strictEqual(isSafeCount(value), false);
      assert.strictEqual(isSafePrice(value), false);
    }
  });

  void it("bounds POST /api/v1/usage request counts", async () => {
    const accepted = await request(app)
      .post("/api/v1/usage")
      .send({
        agent: "agent-safe-count",
        serviceId: sid(),
        requests: MAX_REQUESTS_PER_CALL,
      });
    assert.strictEqual(accepted.status, 201);
    assert.strictEqual(accepted.body.total, MAX_REQUESTS_PER_CALL);

    const rejected = await request(app)
      .post("/api/v1/usage")
      .send({
        agent: "agent-unsafe-count",
        serviceId: sid(),
        requests: MAX_REQUESTS_PER_CALL + 1,
      });
    assert.strictEqual(rejected.status, 400);
    assert.strictEqual(rejected.body.error, "invalid_request");
    assert.match(
      String(rejected.body.message),
      /requests must be a positive integer up to/
    );
  });

  void it("marks oversized bulk usage items invalid without rejecting the whole batch", async () => {
    const res = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "agent-bulk-bound", serviceId: sid(), requests: MAX_REQUESTS_PER_CALL + 1 },
          { agent: "agent-bulk-bound", serviceId: sid(), requests: MAX_REQUESTS_PER_CALL },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body.results[0], {
      index: 0,
      ok: false,
      error: "invalid_item",
    });
    assert.strictEqual(res.body.results[1].ok, true);
    assert.strictEqual(res.body.results[1].total, MAX_REQUESTS_PER_CALL);
  });

  void it("bounds service prices on create, patch, and bulk create", async () => {
    const createAtMax = await request(app)
      .post("/api/v1/services")
      .send({ serviceId: sid(), priceStroops: MAX_PRICE_STROOPS });
    assert.strictEqual(createAtMax.status, 201);
    assert.strictEqual(createAtMax.body.priceStroops, MAX_PRICE_STROOPS);

    const createOverMax = await request(app)
      .post("/api/v1/services")
      .send({ serviceId: sid(), priceStroops: MAX_PRICE_STROOPS + 1 });
    assert.strictEqual(createOverMax.status, 400);
    assert.strictEqual(createOverMax.body.error, "invalid_request");
    assert.match(
      String(createOverMax.body.message),
      /priceStroops must be a non-negative integer up to/
    );

    const patchId = sid();
    await request(app)
      .post("/api/v1/services")
      .send({ serviceId: patchId, priceStroops: 1 });
    const patchOverMax = await request(app)
      .patch(`/api/v1/services/${patchId}/price`)
      .send({ priceStroops: MAX_PRICE_STROOPS + 1 });
    assert.strictEqual(patchOverMax.status, 400);
    assert.strictEqual(patchOverMax.body.error, "invalid_request");

    const bulk = await request(app)
      .post("/api/v1/services/bulk")
      .send({
        items: [
          { serviceId: sid(), priceStroops: MAX_PRICE_STROOPS + 1 },
          { serviceId: sid(), priceStroops: MAX_PRICE_STROOPS },
        ],
      });
    assert.strictEqual(bulk.status, 201);
    assert.deepStrictEqual(bulk.body.results[0], {
      index: 0,
      ok: false,
      error: "invalid_item",
    });
    assert.strictEqual(bulk.body.results[1].ok, true);
  });
});
