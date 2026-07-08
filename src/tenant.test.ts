import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";
import {
  apiKeyStore,
  pauseState,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
} from "./store/state.js";

let seq = 0;
const sid = () => `tenant-svc-${Date.now()}-${++seq}`;

async function createApiKey(label: string): Promise<string> {
  const res = await request(app).post("/api/v1/api-keys").send({ label });
  assert.strictEqual(res.status, 201);
  const key = res.body.key as unknown;
  if (typeof key !== "string") {
    throw new Error("expected API key response to include a string key");
  }
  assert.match(key, /^apk_/);
  return key;
}

beforeEach(() => {
  apiKeyStore.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  pauseState.paused = false;
});

void describe("Tenant scoping", () => {
  void it("lets different API-key tenants register the same serviceId independently", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const serviceId = sid();

    const createA = await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId, priceStroops: 10 });
    assert.strictEqual(createA.status, 201);

    const createB = await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyB)
      .send({ serviceId, priceStroops: 20 });
    assert.strictEqual(createB.status, 201);

    const readA = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", keyA);
    assert.strictEqual(readA.status, 200);
    assert.strictEqual(readA.body.priceStroops, 10);

    const readB = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", keyB);
    assert.strictEqual(readB.status, 200);
    assert.strictEqual(readB.body.priceStroops, 20);

    const readPublic = await request(app).get(`/api/v1/services/${serviceId}`);
    assert.strictEqual(readPublic.status, 404);
    assert.strictEqual(readPublic.body.error, "not_found");

    const listA = await request(app).get("/api/v1/services").set("X-API-Key", keyA);
    const listB = await request(app).get("/api/v1/services").set("X-API-Key", keyB);
    assert.deepStrictEqual(listA.body.services, [
      { serviceId, priceStroops: 10, disabled: false },
    ]);
    assert.deepStrictEqual(listB.body.services, [
      { serviceId, priceStroops: 20, disabled: false },
    ]);
  });

  void it("returns 404 for cross-tenant service mutations without leaking existence", async () => {
    const ownerKey = await createApiKey("owner");
    const otherKey = await createApiKey("other");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", ownerKey)
      .send({ serviceId, priceStroops: 100 })
      .expect(201);

    const price = await request(app)
      .patch(`/api/v1/services/${serviceId}/price`)
      .set("X-API-Key", otherKey)
      .send({ priceStroops: 250 });
    assert.strictEqual(price.status, 404);
    assert.strictEqual(price.body.error, "not_found");

    const metadata = await request(app)
      .put(`/api/v1/services/${serviceId}/metadata`)
      .set("X-API-Key", otherKey)
      .send({ description: "hidden", owner: "other" });
    assert.strictEqual(metadata.status, 404);
    assert.strictEqual(metadata.body.error, "not_found");

    const disabled = await request(app)
      .patch(`/api/v1/services/${serviceId}/disabled`)
      .set("X-API-Key", otherKey)
      .send({ disabled: true });
    assert.strictEqual(disabled.status, 404);
    assert.strictEqual(disabled.body.error, "not_found");

    const deleted = await request(app)
      .delete(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", otherKey);
    assert.strictEqual(deleted.status, 404);
    assert.strictEqual(deleted.body.error, "not_found");

    const ownerRead = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", ownerKey);
    assert.strictEqual(ownerRead.status, 200);
    assert.strictEqual(ownerRead.body.priceStroops, 100);
    assert.strictEqual(ownerRead.body.disabled, false);
  });

  void it("keeps usage rollups and settlement isolated by tenant", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId, priceStroops: 5 })
      .expect(201);
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyB)
      .send({ serviceId, priceStroops: 7 })
      .expect(201);

    await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", keyA)
      .send({ agent: "agent-1", serviceId, requests: 3 })
      .expect(201);
    await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", keyB)
      .send({ agent: "agent-1", serviceId, requests: 2 })
      .expect(201);

    const rollupA = await request(app)
      .get(`/api/v1/services/${serviceId}/usage`)
      .set("X-API-Key", keyA);
    assert.deepStrictEqual(rollupA.body, { serviceId, total: 3, agents: 1 });

    const rollupB = await request(app)
      .get(`/api/v1/services/${serviceId}/usage`)
      .set("X-API-Key", keyB);
    assert.deepStrictEqual(rollupB.body, { serviceId, total: 2, agents: 1 });

    const settleB = await request(app)
      .post("/api/v1/settle")
      .set("X-API-Key", keyB)
      .send({ agent: "agent-1", serviceId });
    assert.strictEqual(settleB.status, 200);
    assert.strictEqual(settleB.body.requests, 2);
    assert.strictEqual(settleB.body.billedStroops, 14);

    const usageAAfterBSettle = await request(app)
      .get(`/api/v1/usage/agent-1/${serviceId}`)
      .set("X-API-Key", keyA);
    assert.strictEqual(usageAAfterBSettle.body.total, 3);

    const settleA = await request(app)
      .post("/api/v1/settle")
      .set("X-API-Key", keyA)
      .send({ agent: "agent-1", serviceId });
    assert.strictEqual(settleA.status, 200);
    assert.strictEqual(settleA.body.requests, 3);
    assert.strictEqual(settleA.body.billedStroops, 15);
  });

  void it("keeps the legacy public tenant separate from API-key tenants", async () => {
    const key = await createApiKey("tenant");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .send({ serviceId, priceStroops: 11 })
      .expect(201);
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "public-agent", serviceId, requests: 4 })
      .expect(201);

    const keyedRead = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", key);
    assert.strictEqual(keyedRead.status, 404);
    assert.strictEqual(keyedRead.body.error, "not_found");

    const keyedUsage = await request(app)
      .get(`/api/v1/usage/public-agent/${serviceId}`)
      .set("X-API-Key", key);
    assert.strictEqual(keyedUsage.body.total, 0);

    const publicUsage = await request(app).get(
      `/api/v1/usage/public-agent/${serviceId}`
    );
    assert.strictEqual(publicUsage.body.total, 4);
  });
});
