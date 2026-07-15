import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { eventLog } from "./events.js";
import {
  apiKeyStore,
  pauseState,
  rateBuckets,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
  webhookStore,
} from "./store/state.js";

const app = createApp();

beforeEach(() => {
  apiKeyStore.clear();
  eventLog.length = 0;
  rateBuckets.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  pauseState.paused = false;
});

async function createApiKey(label: string) {
  const res = await request(app).post("/api/v1/api-keys").send({ label });
  assert.strictEqual(res.status, 201);
  return res.body.key as string;
}

async function createService(apiKey: string, serviceId: string, priceStroops: number) {
  const res = await request(app)
    .post("/api/v1/services")
    .set("X-API-Key", apiKey)
    .send({ serviceId, priceStroops });
  assert.strictEqual(res.status, 201);
  return res;
}

void describe("tenant scoped service and usage state", () => {
  void it("allows the same serviceId to exist independently for two tenants", async () => {
    const tenantA = await createApiKey("tenant-a");
    const tenantB = await createApiKey("tenant-b");

    await createService(tenantA, "shared-service", 10);
    await createService(tenantB, "shared-service", 25);

    const aDetail = await request(app)
      .get("/api/v1/services/shared-service")
      .set("X-API-Key", tenantA);
    const bDetail = await request(app)
      .get("/api/v1/services/shared-service")
      .set("X-API-Key", tenantB);

    assert.strictEqual(aDetail.status, 200);
    assert.strictEqual(bDetail.status, 200);
    assert.strictEqual(aDetail.body.priceStroops, 10);
    assert.strictEqual(bDetail.body.priceStroops, 25);

    const aList = await request(app).get("/api/v1/services").set("X-API-Key", tenantA);
    const bList = await request(app).get("/api/v1/services").set("X-API-Key", tenantB);

    assert.deepStrictEqual(aList.body.services, [
      { serviceId: "shared-service", priceStroops: 10, disabled: false },
    ]);
    assert.deepStrictEqual(bList.body.services, [
      { serviceId: "shared-service", priceStroops: 25, disabled: false },
    ]);
  });

  void it("returns not_found for cross-tenant service reads and mutations", async () => {
    const tenantA = await createApiKey("tenant-a");
    const tenantB = await createApiKey("tenant-b");
    await createService(tenantA, "private-service", 10);

    const detail = await request(app)
      .get("/api/v1/services/private-service")
      .set("X-API-Key", tenantB);
    assert.strictEqual(detail.status, 404);
    assert.strictEqual(detail.body.error, "not_found");

    const price = await request(app)
      .patch("/api/v1/services/private-service/price")
      .set("X-API-Key", tenantB)
      .send({ priceStroops: 99 });
    assert.strictEqual(price.status, 404);
    assert.strictEqual(price.body.error, "not_found");

    const metadata = await request(app)
      .put("/api/v1/services/private-service/metadata")
      .set("X-API-Key", tenantB)
      .send({ description: "should not leak", owner: "tenant-b" });
    assert.strictEqual(metadata.status, 404);
    assert.strictEqual(metadata.body.error, "not_found");

    const disabled = await request(app)
      .patch("/api/v1/services/private-service/disabled")
      .set("X-API-Key", tenantB)
      .send({ disabled: true });
    assert.strictEqual(disabled.status, 404);
    assert.strictEqual(disabled.body.error, "not_found");

    const settle = await request(app)
      .post("/api/v1/settle")
      .set("X-API-Key", tenantB)
      .send({ agent: "agent-a", serviceId: "private-service" });
    assert.strictEqual(settle.status, 404);
    assert.strictEqual(settle.body.error, "not_found");

    const ownerDetail = await request(app)
      .get("/api/v1/services/private-service")
      .set("X-API-Key", tenantA);
    assert.strictEqual(ownerDetail.status, 200);
    assert.strictEqual(ownerDetail.body.priceStroops, 10);
  });

  void it("keeps usage and per-service rollups isolated by tenant", async () => {
    const tenantA = await createApiKey("tenant-a");
    const tenantB = await createApiKey("tenant-b");
    await createService(tenantA, "metered-service", 3);
    await createService(tenantB, "metered-service", 7);

    await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", tenantA)
      .send({ agent: "shared-agent", serviceId: "metered-service", requests: 2 });
    await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", tenantB)
      .send({ agent: "shared-agent", serviceId: "metered-service", requests: 5 });

    const aUsage = await request(app)
      .get("/api/v1/usage/shared-agent/metered-service")
      .set("X-API-Key", tenantA);
    const bUsage = await request(app)
      .get("/api/v1/usage/shared-agent/metered-service")
      .set("X-API-Key", tenantB);
    assert.strictEqual(aUsage.body.total, 2);
    assert.strictEqual(bUsage.body.total, 5);

    const aRollup = await request(app)
      .get("/api/v1/services/metered-service/usage")
      .set("X-API-Key", tenantA);
    const bRollup = await request(app)
      .get("/api/v1/services/metered-service/usage")
      .set("X-API-Key", tenantB);
    assert.deepStrictEqual(aRollup.body, {
      serviceId: "metered-service",
      total: 2,
      agents: 1,
    });
    assert.deepStrictEqual(bRollup.body, {
      serviceId: "metered-service",
      total: 5,
      agents: 1,
    });

    const aBilling = await request(app)
      .get("/api/v1/billing/shared-agent/metered-service")
      .set("X-API-Key", tenantA);
    const bBilling = await request(app)
      .get("/api/v1/billing/shared-agent/metered-service")
      .set("X-API-Key", tenantB);
    assert.strictEqual(aBilling.body.billedStroops, 6);
    assert.strictEqual(bBilling.body.billedStroops, 35);
  });

  void it("uses one implicit tenant when no API key is recognised", async () => {
    await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "open-service", priceStroops: 11 });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "open-agent", serviceId: "open-service", requests: 4 });

    const list = await request(app).get("/api/v1/services");
    assert.deepStrictEqual(list.body.services, [
      { serviceId: "open-service", priceStroops: 11, disabled: false },
    ]);

    const settle = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "open-agent", serviceId: "open-service" });
    assert.strictEqual(settle.status, 200);
    assert.strictEqual(settle.body.billedStroops, 44);
  });
});
