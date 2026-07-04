import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "../index.js";
import { apiKeyStore, servicesStore, usageStore } from "../store/state.js";

function createAppWithIdempotencyEnv(env: { ttlMs?: number; maxEntries?: number }) {
  const previousTtl = process.env.IDEMPOTENCY_CACHE_TTL_MS;
  const previousMax = process.env.IDEMPOTENCY_CACHE_MAX_ENTRIES;

  if (env.ttlMs === undefined) {
    delete process.env.IDEMPOTENCY_CACHE_TTL_MS;
  } else {
    process.env.IDEMPOTENCY_CACHE_TTL_MS = String(env.ttlMs);
  }

  if (env.maxEntries === undefined) {
    delete process.env.IDEMPOTENCY_CACHE_MAX_ENTRIES;
  } else {
    process.env.IDEMPOTENCY_CACHE_MAX_ENTRIES = String(env.maxEntries);
  }

  const app = createApp();

  if (previousTtl === undefined) {
    delete process.env.IDEMPOTENCY_CACHE_TTL_MS;
  } else {
    process.env.IDEMPOTENCY_CACHE_TTL_MS = previousTtl;
  }

  if (previousMax === undefined) {
    delete process.env.IDEMPOTENCY_CACHE_MAX_ENTRIES;
  } else {
    process.env.IDEMPOTENCY_CACHE_MAX_ENTRIES = previousMax;
  }

  return app;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  apiKeyStore.clear();
  servicesStore.clear();
  usageStore.clear();
});

void describe("Idempotency-Key handling", () => {
  void it("replays POST /api/v1/usage without incrementing usage again", async () => {
    const app = createAppWithIdempotencyEnv({});
    const payload = {
      agent: "agent-idem-usage",
      serviceId: "svc-idem-usage",
      requests: 3,
    };

    const first = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "usage-replay")
      .send(payload);
    assert.strictEqual(first.status, 201);
    assert.deepStrictEqual(first.body, {
      agent: "agent-idem-usage",
      serviceId: "svc-idem-usage",
      total: 3,
    });

    const replay = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "usage-replay")
      .send(payload);
    assert.strictEqual(replay.status, 201);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);

    const total = await request(app).get(
      "/api/v1/usage/agent-idem-usage/svc-idem-usage"
    );
    assert.strictEqual(total.body.total, 3);
  });

  void it("rejects reuse of the same key with a different body", async () => {
    const app = createAppWithIdempotencyEnv({});

    await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "usage-conflict")
      .send({
        agent: "agent-idem-conflict",
        serviceId: "svc-idem-conflict",
        requests: 1,
      });

    const conflict = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "usage-conflict")
      .send({
        agent: "agent-idem-conflict",
        serviceId: "svc-idem-conflict",
        requests: 2,
      });
    assert.strictEqual(conflict.status, 409);
    assert.strictEqual(conflict.body.error, "idempotency_conflict");
    assert.ok(conflict.body.requestId);
  });

  void it("replays POST /api/v1/usage/bulk without applying the batch again", async () => {
    const app = createAppWithIdempotencyEnv({});
    const payload = {
      items: [
        { agent: "agent-idem-bulk", serviceId: "svc-idem-bulk", requests: 2 },
        { agent: "agent-idem-bulk", serviceId: "svc-idem-bulk", requests: 4 },
      ],
    };

    const first = await request(app)
      .post("/api/v1/usage/bulk")
      .set("Idempotency-Key", "bulk-replay")
      .send(payload);
    assert.strictEqual(first.status, 201);
    assert.deepStrictEqual(first.body.results, [
      { index: 0, ok: true, total: 2 },
      { index: 1, ok: true, total: 6 },
    ]);

    const replay = await request(app)
      .post("/api/v1/usage/bulk")
      .set("Idempotency-Key", "bulk-replay")
      .send(payload);
    assert.strictEqual(replay.status, 201);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);

    const total = await request(app).get("/api/v1/usage/agent-idem-bulk/svc-idem-bulk");
    assert.strictEqual(total.body.total, 6);
  });

  void it("replays POST /api/v1/settle without draining a second time", async () => {
    const app = createAppWithIdempotencyEnv({});
    servicesStore.set("svc-idem-settle", { priceStroops: 10 });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-idem-settle", serviceId: "svc-idem-settle", requests: 5 });

    const payload = { agent: "agent-idem-settle", serviceId: "svc-idem-settle" };
    const first = await request(app)
      .post("/api/v1/settle")
      .set("Idempotency-Key", "settle-replay")
      .send(payload);
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.requests, 5);
    assert.strictEqual(first.body.billedStroops, 50);

    const replay = await request(app)
      .post("/api/v1/settle")
      .set("Idempotency-Key", "settle-replay")
      .send(payload);
    assert.strictEqual(replay.status, 200);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
  });

  void it("namespaces idempotency keys by recognized API key", async () => {
    const app = createAppWithIdempotencyEnv({});
    apiKeyStore.set("tenant-a-secret", { label: "tenant-a", createdAt: Date.now() });
    apiKeyStore.set("tenant-b-secret", { label: "tenant-b", createdAt: Date.now() });
    const payload = {
      agent: "agent-idem-tenant",
      serviceId: "svc-idem-tenant",
      requests: 2,
    };

    const first = await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", "tenant-a-secret")
      .set("Idempotency-Key", "shared-key")
      .send(payload);
    assert.strictEqual(first.status, 201);

    const tenantAReplay = await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", "tenant-a-secret")
      .set("Idempotency-Key", "shared-key")
      .send(payload);
    assert.strictEqual(tenantAReplay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(tenantAReplay.body, first.body);

    const tenantBFirst = await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", "tenant-b-secret")
      .set("Idempotency-Key", "shared-key")
      .send(payload);
    assert.strictEqual(tenantBFirst.status, 201);
    assert.strictEqual(tenantBFirst.headers["idempotency-replayed"], undefined);
    assert.strictEqual(tenantBFirst.body.total, 4);
  });

  void it("expires cached responses after the configured TTL", async () => {
    const app = createAppWithIdempotencyEnv({ ttlMs: 5 });
    const payload = {
      agent: "agent-idem-ttl",
      serviceId: "svc-idem-ttl",
      requests: 1,
    };

    const first = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "ttl-key")
      .send(payload);
    assert.strictEqual(first.status, 201);

    const replay = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "ttl-key")
      .send(payload);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);

    await sleep(15);

    const afterExpiry = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "ttl-key")
      .send(payload);
    assert.strictEqual(afterExpiry.status, 201);
    assert.strictEqual(afterExpiry.headers["idempotency-replayed"], undefined);
    assert.strictEqual(afterExpiry.body.total, 2);
  });

  void it("evicts the oldest idempotency entry when the cache is capped", async () => {
    const app = createAppWithIdempotencyEnv({ maxEntries: 1 });
    const payloadA = {
      agent: "agent-idem-cap-a",
      serviceId: "svc-idem-cap",
      requests: 1,
    };
    const payloadB = {
      agent: "agent-idem-cap-b",
      serviceId: "svc-idem-cap",
      requests: 1,
    };

    const firstA = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "cap-a")
      .send(payloadA);
    assert.strictEqual(firstA.status, 201);

    const replayA = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "cap-a")
      .send(payloadA);
    assert.strictEqual(replayA.headers["idempotency-replayed"], "true");

    await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "cap-b")
      .send(payloadB);

    const afterEviction = await request(app)
      .post("/api/v1/usage")
      .set("Idempotency-Key", "cap-a")
      .send(payloadA);
    assert.strictEqual(afterEviction.status, 201);
    assert.strictEqual(afterEviction.headers["idempotency-replayed"], undefined);
    assert.strictEqual(afterEviction.body.total, 2);
  });
});
