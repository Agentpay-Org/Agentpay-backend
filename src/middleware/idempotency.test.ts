import { describe, it } from "node:test";
import assert from "node:assert";
import express, { type Request, type Response } from "express";
import request from "supertest";
import { app } from "../index.js";
import { createIdempotencyMiddleware } from "./idempotency.js";

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeIsolatedApp(options: Parameters<typeof createIdempotencyMiddleware>[0]) {
  const isolated = express();
  let total = 0;
  isolated.use(express.json());
  isolated.use((req: Request, _res: Response, next) => {
    (req as Request & { id: string }).id = "isolated-request";
    next();
  });
  isolated.use(createIdempotencyMiddleware(options));
  isolated.post("/api/v1/usage", (req: Request, res: Response) => {
    total += Number(req.body?.requests ?? 1);
    res.status(201).json({ total });
  });
  return isolated;
}

void describe("Idempotency-Key middleware", () => {
  void it("replays POST /usage without incrementing usage twice", async () => {
    const agent = unique("idem-agent");
    const serviceId = unique("idem-service");
    const key = unique("idem-key");
    const body = { agent, serviceId, requests: 4 };

    const first = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", key)
      .send(body);
    assert.strictEqual(first.status, 201);
    assert.deepStrictEqual(first.body, { agent, serviceId, total: 4 });

    const replay = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", key)
      .send(body);
    assert.strictEqual(replay.status, 201);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);

    const usage = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);
    assert.strictEqual(usage.body.total, 4);
  });

  void it("returns 409 when a key is reused with a different body", async () => {
    const agent = unique("idem-conflict-agent");
    const serviceId = unique("idem-conflict-service");
    const key = unique("idem-conflict-key");

    const first = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", key)
      .send({ agent, serviceId, requests: 1 });
    assert.strictEqual(first.status, 201);

    const conflict = await request(app)
      .post("/api/v1/usage")
      .set("X-Request-Id", "idem-conflict-request")
      .set("Idempotency-Key", key)
      .send({ agent, serviceId, requests: 2 });
    assert.strictEqual(conflict.status, 409);
    assert.strictEqual(conflict.body.error, "idempotency_conflict");
    assert.strictEqual(conflict.body.requestId, "idem-conflict-request");

    const usage = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);
    assert.strictEqual(usage.body.total, 1);
  });

  void it("replays POST /usage/bulk without duplicating totals", async () => {
    const agent = unique("idem-bulk-agent");
    const serviceId = unique("idem-bulk-service");
    const key = unique("idem-bulk-key");
    const body = {
      items: [
        { agent, serviceId, requests: 2 },
        { agent, serviceId, requests: 3 },
      ],
    };

    const first = await request(app)
      .post("/api/v1/usage/bulk")
      .set("Idempotency-Key", key)
      .send(body);
    assert.strictEqual(first.status, 201);

    const replay = await request(app)
      .post("/api/v1/usage/bulk")
      .set("Idempotency-Key", key)
      .send(body);
    assert.strictEqual(replay.status, 201);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);

    const usage = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);
    assert.strictEqual(usage.body.total, 5);
  });

  void it("replays POST /settle without draining a second time", async () => {
    const agent = unique("idem-settle-agent");
    const serviceId = unique("idem-settle-service");
    const key = unique("idem-settle-key");

    await request(app).post("/api/v1/services").send({ serviceId, priceStroops: 7 });
    await request(app).post("/api/v1/usage").send({ agent, serviceId, requests: 3 });

    const first = await request(app)
      .post("/api/v1/settle")
      .set("Idempotency-Key", key)
      .send({ agent, serviceId });
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.requests, 3);
    assert.strictEqual(first.body.billedStroops, 21);

    const replay = await request(app)
      .post("/api/v1/settle")
      .set("Idempotency-Key", key)
      .send({ agent, serviceId });
    assert.strictEqual(replay.status, 200);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);

    const usage = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);
    assert.strictEqual(usage.body.total, 0);
  });

  void it("expires cached keys by TTL", async () => {
    let now = 1_000;
    const isolated = makeIsolatedApp({ ttlMs: 10, now: () => now });

    const first = await request(isolated)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "ttl-key")
      .send({ requests: 1 });
    assert.strictEqual(first.body.total, 1);

    now = 1_005;
    const replay = await request(isolated)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "ttl-key")
      .send({ requests: 1 });
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.strictEqual(replay.body.total, 1);

    now = 1_011;
    const expired = await request(isolated)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "ttl-key")
      .send({ requests: 1 });
    assert.strictEqual(expired.headers["idempotency-replayed"], undefined);
    assert.strictEqual(expired.body.total, 2);
  });

  void it("evicts the oldest cached response when the cap is exceeded", async () => {
    const isolated = makeIsolatedApp({ maxEntries: 1 });

    await request(isolated)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "first-key")
      .send({ requests: 1 });
    await request(isolated)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "second-key")
      .send({ requests: 1 });

    const evicted = await request(isolated)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "first-key")
      .send({ requests: 1 });
    assert.strictEqual(evicted.headers["idempotency-replayed"], undefined);
    assert.strictEqual(evicted.body.total, 3);
  });
});
