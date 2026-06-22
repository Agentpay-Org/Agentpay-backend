import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { app } from "../index.js";
import { createIdempotencyMiddleware } from "./idempotency.js";

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++seq}`;

beforeEach(async () => {
  await request(app).post("/api/v1/admin/unpause");
});

void describe("Idempotency-Key handling", () => {
  void it("replays POST /api/v1/usage without incrementing the accumulator again", async () => {
    const agent = nextId("agent-idem-usage");
    const serviceId = nextId("svc-idem-usage");
    const key = nextId("key-usage");
    const payload = { agent, serviceId, requests: 5 };

    const first = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", key)
      .send(payload);
    const replay = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", key)
      .send(payload);
    const usage = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);

    assert.strictEqual(first.status, 201);
    assert.strictEqual(replay.status, 201);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
    assert.strictEqual(usage.body.total, 5);
  });

  void it("rejects reuse of the same key with a different request body", async () => {
    const agent = nextId("agent-idem-conflict");
    const serviceId = nextId("svc-idem-conflict");
    const key = nextId("key-conflict");

    const first = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", key)
      .send({ agent, serviceId, requests: 5 });
    const conflict = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", key)
      .send({ agent, serviceId, requests: 6 });
    const usage = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);

    assert.strictEqual(first.status, 201);
    assert.strictEqual(conflict.status, 409);
    assert.strictEqual(conflict.body.error, "idempotency_conflict");
    assert.ok(conflict.body.requestId);
    assert.strictEqual(usage.body.total, 5);
  });

  void it("replays POST /api/v1/usage/bulk without applying the batch again", async () => {
    const agent = nextId("agent-idem-bulk");
    const serviceId = nextId("svc-idem-bulk");
    const key = nextId("key-bulk");
    const payload = { items: [{ agent, serviceId, requests: 4 }] };

    const first = await request(app)
      .post("/api/v1/usage/bulk")
      .set("Idempotency-Key", key)
      .send(payload);
    const replay = await request(app)
      .post("/api/v1/usage/bulk")
      .set("Idempotency-Key", key)
      .send(payload);
    const usage = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);

    assert.strictEqual(first.status, 201);
    assert.strictEqual(replay.status, 201);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
    assert.strictEqual(usage.body.total, 4);
  });

  void it("replays POST /api/v1/settle without draining a second time", async () => {
    const agent = nextId("agent-idem-settle");
    const serviceId = nextId("svc-idem-settle");
    const key = nextId("key-settle");

    await request(app).post("/api/v1/services").send({ serviceId, priceStroops: 10 });
    await request(app).post("/api/v1/usage").send({ agent, serviceId, requests: 3 });

    const first = await request(app)
      .post("/api/v1/settle")
      .set("Idempotency-Key", key)
      .send({ agent, serviceId });
    const replay = await request(app)
      .post("/api/v1/settle")
      .set("Idempotency-Key", key)
      .send({ agent, serviceId });
    const after = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);

    assert.strictEqual(first.status, 200);
    assert.strictEqual(replay.status, 200);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
    assert.strictEqual(first.body.billedStroops, 30);
    assert.strictEqual(after.body.total, 0);
  });

  void it("allows execution again after the idempotency cache TTL expires", async () => {
    let now = 1_000;
    const ttlApp = express();
    ttlApp.use(express.json());
    ttlApp.use(
      createIdempotencyMiddleware({
        now: () => now,
        ttlMs: 10,
        routes: [{ method: "POST", path: "/charge" }],
      })
    );

    let calls = 0;
    ttlApp.post("/charge", (_req, res) => {
      calls += 1;
      res.status(201).json({ calls });
    });

    const first = await request(ttlApp)
      .post("/charge")
      .set("Idempotency-Key", "ttl-key")
      .send({ amount: 1 });
    const replay = await request(ttlApp)
      .post("/charge")
      .set("Idempotency-Key", "ttl-key")
      .send({ amount: 1 });
    now += 11;
    const afterTtl = await request(ttlApp)
      .post("/charge")
      .set("Idempotency-Key", "ttl-key")
      .send({ amount: 1 });

    assert.strictEqual(first.status, 201);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, { calls: 1 });
    assert.strictEqual(afterTtl.headers["idempotency-replayed"], undefined);
    assert.deepStrictEqual(afterTtl.body, { calls: 2 });
  });
});
