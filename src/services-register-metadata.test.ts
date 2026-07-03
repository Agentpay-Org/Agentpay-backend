import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { servicesMetadata, servicesStore } from "./store/state.js";

const app = createApp();
let sequence = 0;

function serviceId(prefix = "svc-inline-meta") {
  sequence += 1;
  return `${prefix}-${Date.now()}-${sequence}`;
}

beforeEach(() => {
  servicesStore.clear();
  servicesMetadata.clear();
});

void describe("POST /api/v1/services inline metadata", () => {
  void it("persists and returns description and owner atomically on create", async () => {
    const id = serviceId();

    const res = await request(app).post("/api/v1/services").send({
      serviceId: id,
      priceStroops: 42,
      description: "Embeddings for support tickets",
      owner: "platform-team",
    });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body, {
      serviceId: id,
      priceStroops: 42,
      description: "Embeddings for support tickets",
      owner: "platform-team",
    });
    assert.deepStrictEqual(servicesStore.get(id), { priceStroops: 42 });
    assert.deepStrictEqual(servicesMetadata.get(id), {
      description: "Embeddings for support tickets",
      owner: "platform-team",
    });

    const metadata = await request(app).get(`/api/v1/services/${id}/metadata`);
    assert.strictEqual(metadata.status, 200);
    assert.strictEqual(metadata.body.owner, "platform-team");
  });

  void it("keeps the existing no-metadata registration behavior", async () => {
    const id = serviceId();

    const res = await request(app).post("/api/v1/services").send({
      serviceId: id,
      priceStroops: 7,
    });

    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(res.body, { serviceId: id, priceStroops: 7 });
    assert.strictEqual(servicesMetadata.has(id), false);
  });

  void it("rejects invalid metadata without registering the service", async () => {
    const id = serviceId();

    const res = await request(app)
      .post("/api/v1/services")
      .send({
        serviceId: id,
        priceStroops: 9,
        description: "x".repeat(257),
        owner: "team",
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.strictEqual(servicesStore.has(id), false);
    assert.strictEqual(servicesMetadata.has(id), false);
  });

  for (const [label, body] of [
    ["description without owner", { description: "missing owner" }],
    ["owner without description", { owner: "missing-description" }],
    ["empty owner", { description: "valid", owner: "" }],
  ] as const) {
    void it(`rejects ${label} atomically`, async () => {
      const id = serviceId();
      const res = await request(app)
        .post("/api/v1/services")
        .send({ serviceId: id, priceStroops: 11, ...body });

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error, "invalid_request");
      assert.strictEqual(servicesStore.has(id), false);
      assert.strictEqual(servicesMetadata.has(id), false);
    });
  }

  void it("preserves upsert status while updating inline metadata", async () => {
    const id = serviceId();
    servicesStore.set(id, { priceStroops: 1 });

    const res = await request(app).post("/api/v1/services").send({
      serviceId: id,
      priceStroops: 99,
      description: "Updated service",
      owner: "billing-team",
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.priceStroops, 99);
    assert.strictEqual(res.body.owner, "billing-team");
    assert.deepStrictEqual(servicesMetadata.get(id), {
      description: "Updated service",
      owner: "billing-team",
    });
  });
});
