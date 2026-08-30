import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import {
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  servicesVersions,
} from "./store/state.js";

const app = createApp();
let sequence = 0;

function serviceId(): string {
  sequence += 1;
  return `svc-occ-${Date.now()}-${sequence}`;
}

async function register(id: string, priceStroops = 10) {
  const response = await request(app)
    .post("/api/v1/services")
    .send({ serviceId: id, priceStroops });
  assert.strictEqual(response.status, 201);
  return response;
}

beforeEach(() => {
  servicesStore.clear();
  servicesVersions.clear();
  servicesMetadata.clear();
  servicesDisabled.clear();
});

void describe("service update optimistic concurrency", () => {
  void it("returns version one on every newly registered service read", async () => {
    const id = serviceId();
    await register(id);

    const detail = await request(app).get(`/api/v1/services/${id}`);
    assert.strictEqual(detail.status, 200);
    assert.strictEqual(detail.body.version, 1);

    const list = await request(app).get(`/api/v1/services?prefix=${id}`);
    assert.strictEqual(list.status, 200);
    assert.strictEqual(list.body.services[0].version, 1);
  });

  void it("rejects a price mutation without a version", async () => {
    const id = serviceId();
    await register(id);
    const response = await request(app)
      .patch(`/api/v1/services/${id}/price`)
      .send({ priceStroops: 20 });

    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error, "invalid_request");
    assert.strictEqual(servicesStore.get(id)?.priceStroops, 10);
    assert.strictEqual(servicesVersions.get(id), 1);
  });

  void it("advances once for a successful price update", async () => {
    const id = serviceId();
    await register(id);
    const response = await request(app)
      .patch(`/api/v1/services/${id}/price`)
      .send({ priceStroops: 20, expectedVersion: 1 });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.version, 2);
    assert.strictEqual(servicesVersions.get(id), 2);
  });

  void it("rejects two writers that both read the same base version", async () => {
    const id = serviceId();
    await register(id);
    const first = await request(app)
      .patch(`/api/v1/services/${id}/price`)
      .send({ priceStroops: 20, expectedVersion: 1 });
    const second = await request(app)
      .patch(`/api/v1/services/${id}/price`)
      .send({ priceStroops: 30, expectedVersion: 1 });

    assert.strictEqual(first.status, 200);
    assert.strictEqual(second.status, 409);
    assert.strictEqual(second.body.error, "version_conflict");
    assert.strictEqual(second.body.currentVersion, 2);
    assert.strictEqual(second.body.expectedVersion, 1);
    assert.strictEqual(second.body.retryable, true);
    assert.strictEqual(servicesStore.get(id)?.priceStroops, 20);
  });

  void it("rejects a future version without changing state", async () => {
    const id = serviceId();
    await register(id);
    const response = await request(app)
      .patch(`/api/v1/services/${id}/price`)
      .send({ priceStroops: 20, expectedVersion: 99 });

    assert.strictEqual(response.status, 409);
    assert.strictEqual(response.body.currentVersion, 1);
    assert.strictEqual(servicesStore.get(id)?.priceStroops, 10);
  });

  void it("guards metadata and disabled updates with the same clock", async () => {
    const id = serviceId();
    await register(id);
    const metadata = await request(app)
      .put(`/api/v1/services/${id}/metadata`)
      .send({ description: "Risk scoring", owner: "platform", expectedVersion: 1 });
    assert.strictEqual(metadata.status, 200);
    assert.strictEqual(metadata.body.version, 2);

    const disabled = await request(app)
      .patch(`/api/v1/services/${id}/disabled`)
      .send({ disabled: true, expectedVersion: 2 });
    assert.strictEqual(disabled.status, 200);
    assert.strictEqual(disabled.body.version, 3);

    const read = await request(app).get(`/api/v1/services/${id}/metadata`);
    assert.strictEqual(read.status, 200);
    assert.strictEqual(read.body.version, 3);
  });

  void it("does not leak internal keys in a conflict response", async () => {
    const id = serviceId();
    await register(id);
    const response = await request(app)
      .patch(`/api/v1/services/${id}/price`)
      .send({ priceStroops: 12, expectedVersion: 0 });

    assert.strictEqual(response.status, 400);
    assert.strictEqual("tenantKey" in response.body, false);
    assert.strictEqual("stack" in response.body, false);
    assert.strictEqual("servicesStore" in response.body, false);
  });
});
