import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { hashApiKey } from "./auth/apiKeys.js";
import { apiKeyStore, servicesStore, servicesDisabled, servicesMetadata } from "./store/state.js";

let seq = 0;
function sid(prefix = "svc-idem") {
  seq += 1;
  return `${prefix}-${Date.now()}-${seq}`;
}

beforeEach(() => {
  servicesStore.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  apiKeyStore.clear();
});

void describe("Idempotency-Key on services write endpoints", () => {
  void it("POST /api/v1/services — first write succeeds and replay returns cached result", async () => {
    const app = createApp();
    const id = sid();
    const payload = { serviceId: id, priceStroops: 50 };

    const first = await request(app)
      .post("/api/v1/services")
      .set("Idempotency-Key", "svc-create-key")
      .send(payload);
    assert.strictEqual(first.status, 201);
    assert.deepStrictEqual(first.body, { serviceId: id, priceStroops: 50 });

    const replay = await request(app)
      .post("/api/v1/services")
      .set("Idempotency-Key", "svc-create-key")
      .send(payload);
    assert.strictEqual(replay.status, 201);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
  });

  void it("POST /api/v1/services — different body with same key returns 409", async () => {
    const app = createApp();
    const id = sid();

    await request(app)
      .post("/api/v1/services")
      .set("Idempotency-Key", "svc-conflict-key")
      .send({ serviceId: id, priceStroops: 50 });

    const conflict = await request(app)
      .post("/api/v1/services")
      .set("Idempotency-Key", "svc-conflict-key")
      .send({ serviceId: id, priceStroops: 999 });
    assert.strictEqual(conflict.status, 409);
    assert.strictEqual(conflict.body.error, "idempotency_conflict");
    assert.ok(conflict.body.requestId);
  });

  void it("POST /api/v1/services — without key works normally", async () => {
    const app = createApp();
    const id = sid();

    const res = await request(app)
      .post("/api/v1/services")
      .send({ serviceId: id, priceStroops: 10 });
    assert.strictEqual(res.status, 201);

    const res2 = await request(app)
      .post("/api/v1/services")
      .send({ serviceId: id, priceStroops: 20 });
    assert.strictEqual(res2.status, 200);
    assert.strictEqual(res2.body.priceStroops, 20);
  });

  void it("POST /api/v1/services/bulk — replay returns cached result without re-registering", async () => {
    const app = createApp();
    const a = sid("bulk-a");
    const b = sid("bulk-b");
    const payload = {
      items: [
        { serviceId: a, priceStroops: 10 },
        { serviceId: b, priceStroops: 20 },
      ],
    };

    const first = await request(app)
      .post("/api/v1/services/bulk")
      .set("Idempotency-Key", "bulk-key")
      .send(payload);
    assert.strictEqual(first.status, 201);
    assert.strictEqual(first.body.results.length, 2);
    assert.ok(first.body.results.every((r: { ok: boolean }) => r.ok));

    const replay = await request(app)
      .post("/api/v1/services/bulk")
      .set("Idempotency-Key", "bulk-key")
      .send(payload);
    assert.strictEqual(replay.status, 201);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
  });

  void it("POST /api/v1/services/:serviceId/disable — replay returns cached result", async () => {
    const app = createApp();
    const id = sid();
    servicesStore.set(id, { priceStroops: 5 });

    const first = await request(app)
      .post(`/api/v1/services/${id}/disable`)
      .set("Idempotency-Key", "disable-key")
      .send();
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.disabled, true);

    const replay = await request(app)
      .post(`/api/v1/services/${id}/disable`)
      .set("Idempotency-Key", "disable-key")
      .send();
    assert.strictEqual(replay.status, 200);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
  });

  void it("POST /api/v1/services/:serviceId/enable — replay returns cached result", async () => {
    const app = createApp();
    const id = sid();
    servicesStore.set(id, { priceStroops: 5 });
    servicesDisabled.add(id);

    const first = await request(app)
      .post(`/api/v1/services/${id}/enable`)
      .set("Idempotency-Key", "enable-key")
      .send();
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.disabled, false);

    const replay = await request(app)
      .post(`/api/v1/services/${id}/enable`)
      .set("Idempotency-Key", "enable-key")
      .send();
    assert.strictEqual(replay.status, 200);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
  });

  void it("PUT /api/v1/services/:serviceId/metadata — replay returns cached result", async () => {
    const app = createApp();
    const id = sid();
    servicesStore.set(id, { priceStroops: 5 });
    const payload = { description: "Test service", owner: "test-owner" };

    const first = await request(app)
      .put(`/api/v1/services/${id}/metadata`)
      .set("Idempotency-Key", "meta-key")
      .send(payload);
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.description, "Test service");

    const replay = await request(app)
      .put(`/api/v1/services/${id}/metadata`)
      .set("Idempotency-Key", "meta-key")
      .send(payload);
    assert.strictEqual(replay.status, 200);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
  });

  void it("PUT /api/v1/services/:serviceId/metadata — different body with same key returns 409", async () => {
    const app = createApp();
    const id = sid();
    servicesStore.set(id, { priceStroops: 5 });

    await request(app)
      .put(`/api/v1/services/${id}/metadata`)
      .set("Idempotency-Key", "meta-conflict")
      .send({ description: "Original", owner: "alice" });

    const conflict = await request(app)
      .put(`/api/v1/services/${id}/metadata`)
      .set("Idempotency-Key", "meta-conflict")
      .send({ description: "Different", owner: "bob" });
    assert.strictEqual(conflict.status, 409);
    assert.strictEqual(conflict.body.error, "idempotency_conflict");
  });

  void it("PATCH /api/v1/services/:serviceId/disabled — replay returns cached result", async () => {
    const app = createApp();
    const id = sid();
    servicesStore.set(id, { priceStroops: 5 });

    const first = await request(app)
      .patch(`/api/v1/services/${id}/disabled`)
      .set("Idempotency-Key", "patch-disabled-key")
      .send({ disabled: true });
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.disabled, true);

    const replay = await request(app)
      .patch(`/api/v1/services/${id}/disabled`)
      .set("Idempotency-Key", "patch-disabled-key")
      .send({ disabled: true });
    assert.strictEqual(replay.status, 200);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
  });

  void it("PATCH /api/v1/services/:serviceId/price — replay returns cached result", async () => {
    const app = createApp();
    const id = sid();
    servicesStore.set(id, { priceStroops: 5 });

    const first = await request(app)
      .patch(`/api/v1/services/${id}/price`)
      .set("Idempotency-Key", "price-key")
      .send({ priceStroops: 100 });
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.body.priceStroops, 100);

    const replay = await request(app)
      .patch(`/api/v1/services/${id}/price`)
      .set("Idempotency-Key", "price-key")
      .send({ priceStroops: 100 });
    assert.strictEqual(replay.status, 200);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
  });

  void it("PATCH /api/v1/services/:serviceId/price — different body with same key returns 409", async () => {
    const app = createApp();
    const id = sid();
    servicesStore.set(id, { priceStroops: 5 });

    await request(app)
      .patch(`/api/v1/services/${id}/price`)
      .set("Idempotency-Key", "price-conflict")
      .send({ priceStroops: 100 });

    const conflict = await request(app)
      .patch(`/api/v1/services/${id}/price`)
      .set("Idempotency-Key", "price-conflict")
      .send({ priceStroops: 200 });
    assert.strictEqual(conflict.status, 409);
    assert.strictEqual(conflict.body.error, "idempotency_conflict");
  });

  void it("replays error responses (e.g. 400, 404) on repeat of same request", async () => {
    const app = createApp();

    const first = await request(app)
      .post("/api/v1/services")
      .set("Idempotency-Key", "err-replay")
      .send({ priceStroops: 10 });
    assert.strictEqual(first.status, 400);

    const replay = await request(app)
      .post("/api/v1/services")
      .set("Idempotency-Key", "err-replay")
      .send({ priceStroops: 10 });
    assert.strictEqual(replay.status, 400);
    assert.strictEqual(replay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(replay.body, first.body);
  });

  void it("namespaces idempotency keys by API key for service writes", async () => {
    const app = createApp();
    const tenantAHash = hashApiKey("tenant-a-secret");
    const tenantBHash = hashApiKey("tenant-b-secret");
    apiKeyStore.set(tenantAHash, { label: "tenant-a", createdAt: Date.now(), prefix: "tnt-a" });
    apiKeyStore.set(tenantBHash, { label: "tenant-b", createdAt: Date.now(), prefix: "tnt-b" });
    const id = sid();
    const payload = { serviceId: id, priceStroops: 42 };

    const first = await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", "tenant-a-secret")
      .set("Idempotency-Key", "shared-key")
      .send(payload);
    assert.strictEqual(first.status, 201);

    const tenantAReplay = await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", "tenant-a-secret")
      .set("Idempotency-Key", "shared-key")
      .send(payload);
    assert.strictEqual(tenantAReplay.headers["idempotency-replayed"], "true");
    assert.deepStrictEqual(tenantAReplay.body, first.body);

    const tenantBFirst = await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", "tenant-b-secret")
      .set("Idempotency-Key", "shared-key")
      .send(payload);
    assert.strictEqual(tenantBFirst.status, 201);
    assert.strictEqual(tenantBFirst.headers["idempotency-replayed"], undefined);
  });
});
