import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++seq}`;

async function registerService(serviceId: string, priceStroops: number) {
  const res = await request(app)
    .post("/api/v1/services")
    .send({ serviceId, priceStroops });
  assert.strictEqual(res.status, 201);
}

beforeEach(async () => {
  await request(app).post("/api/v1/admin/unpause");
});

void describe("BigInt stroops billing responses", () => {
  void it("returns exact string billedStroops for pair billing above Number.MAX_SAFE_INTEGER", async () => {
    const agent = nextId("agent-big-quote");
    const serviceId = nextId("svc-big-quote");
    await registerService(serviceId, 100);
    await request(app)
      .post("/api/v1/usage")
      .send({ agent, serviceId, requests: Number.MAX_SAFE_INTEGER });

    const res = await request(app).get(`/api/v1/billing/${agent}/${serviceId}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.requests, Number.MAX_SAFE_INTEGER);
    assert.strictEqual(res.body.priceStroops, 100);
    assert.strictEqual(res.body.billedStroops, "900719925474099100");

    await request(app).post("/api/v1/settle").send({ agent, serviceId });
  });

  void it("returns exact string billedStroops from settle and still drains usage", async () => {
    const agent = nextId("agent-big-settle");
    const serviceId = nextId("svc-big-settle");
    await registerService(serviceId, 100);
    await request(app)
      .post("/api/v1/usage")
      .send({ agent, serviceId, requests: Number.MAX_SAFE_INTEGER });

    const settle = await request(app).post("/api/v1/settle").send({ agent, serviceId });

    assert.strictEqual(settle.status, 200);
    assert.strictEqual(settle.body.billedStroops, "900719925474099100");

    const after = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);
    assert.strictEqual(after.body.total, 0);
  });

  void it("returns exact string totalStroops across multiple services", async () => {
    const agent = nextId("agent-total");
    const largeServiceId = nextId("svc-total-large");
    const smallServiceId = nextId("svc-total-small");
    await registerService(largeServiceId, 100);
    await registerService(smallServiceId, 3);
    await request(app)
      .post("/api/v1/usage")
      .send({ agent, serviceId: largeServiceId, requests: Number.MAX_SAFE_INTEGER });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent, serviceId: smallServiceId, requests: 7 });

    const res = await request(app).get("/api/v1/billing/total");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.totalStroops, "900719925474099121");
  });

  void it("keeps registered zero-price service billing as a string zero", async () => {
    const agent = nextId("agent-free");
    const serviceId = nextId("svc-free");
    await registerService(serviceId, 0);
    await request(app)
      .post("/api/v1/usage")
      .send({ agent, serviceId, requests: Number.MAX_SAFE_INTEGER });

    const res = await request(app).get(`/api/v1/billing/${agent}/${serviceId}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.billedStroops, "0");
  });
});
