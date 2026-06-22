import { describe, it } from "node:test";
import assert from "node:assert";
import request, { type Response } from "supertest";
import { app } from "./index.js";

let seq = 0;
const unique = (label: string) => `settle-${Date.now()}-${++seq}-${label}`;

type ErrorEnvelope = {
  error?: unknown;
  message?: unknown;
  requestId?: unknown;
};

type UnpricedUsage = {
  agent?: unknown;
  serviceId?: unknown;
  requests?: unknown;
};

function assertErrorEnvelope(
  res: Response,
  expected: { status: number; error: string }
) {
  assert.strictEqual(res.status, expected.status);
  const body = res.body as ErrorEnvelope;
  assert.strictEqual(body.error, expected.error);
  assert.strictEqual(typeof body.message, "string");
  assert.ok((body.message as string).length > 0);
  assert.strictEqual(typeof body.requestId, "string");
  assert.ok((body.requestId as string).length > 0);
  assert.strictEqual(res.headers["x-request-id"], body.requestId);
}

async function createService(serviceId: string, priceStroops: number) {
  const res = await request(app)
    .post("/api/v1/services")
    .send({ serviceId, priceStroops });
  assert.strictEqual(res.status, 201);
}

async function recordUsage(agent: string, serviceId: string, requests: number) {
  const res = await request(app)
    .post("/api/v1/usage")
    .send({ agent, serviceId, requests });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.total, requests);
}

void describe("Billing and settlement service registration checks", () => {
  void it("returns 404 for unknown service billing instead of pricing at zero", async () => {
    const agent = unique("agent");
    const serviceId = unique("missing-service");
    await recordUsage(agent, serviceId, 3);

    const res = await request(app).get(`/api/v1/billing/${agent}/${serviceId}`);
    assertErrorEnvelope(res, { status: 404, error: "not_found" });
  });

  void it("does not drain usage when settling an unknown service", async () => {
    const agent = unique("agent");
    const serviceId = unique("missing-service");
    await recordUsage(agent, serviceId, 5);

    const settle = await request(app).post("/api/v1/settle").send({ agent, serviceId });
    assertErrorEnvelope(settle, { status: 404, error: "not_found" });

    const usage = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);
    assert.strictEqual(usage.status, 200);
    assert.strictEqual(usage.body.total, 5);
  });

  void it("keeps billing and settle response shapes for registered services", async () => {
    const agent = unique("agent");
    const serviceId = unique("service");
    await createService(serviceId, 25);
    await recordUsage(agent, serviceId, 4);

    const billing = await request(app).get(`/api/v1/billing/${agent}/${serviceId}`);
    assert.strictEqual(billing.status, 200);
    assert.deepStrictEqual(billing.body, {
      agent,
      serviceId,
      requests: 4,
      priceStroops: 25,
      billedStroops: 100,
    });

    const settle = await request(app).post("/api/v1/settle").send({ agent, serviceId });
    assert.strictEqual(settle.status, 200);
    assert.deepStrictEqual(settle.body, {
      agent,
      serviceId,
      requests: 4,
      priceStroops: 25,
      billedStroops: 100,
    });

    const after = await request(app).get(`/api/v1/usage/${agent}/${serviceId}`);
    assert.strictEqual(after.status, 200);
    assert.strictEqual(after.body.total, 0);
  });

  void it("continues to support registered zero-price services", async () => {
    const agent = unique("agent");
    const serviceId = unique("free-service");
    await createService(serviceId, 0);
    await recordUsage(agent, serviceId, 6);

    const billing = await request(app).get(`/api/v1/billing/${agent}/${serviceId}`);
    assert.strictEqual(billing.status, 200);
    assert.strictEqual(billing.body.priceStroops, 0);
    assert.strictEqual(billing.body.billedStroops, 0);

    const settle = await request(app).post("/api/v1/settle").send({ agent, serviceId });
    assert.strictEqual(settle.status, 200);
    assert.strictEqual(settle.body.priceStroops, 0);
    assert.strictEqual(settle.body.billedStroops, 0);
  });

  void it("surfaces unpriced usage separately in protocol-wide billing totals", async () => {
    const paidAgent = unique("paid-agent");
    const paidService = unique("paid-service");
    const missingAgent = unique("missing-agent");
    const missingService = unique("missing-service");
    await createService(paidService, 10);
    await recordUsage(paidAgent, paidService, 2);
    await recordUsage(missingAgent, missingService, 7);

    const total = await request(app).get("/api/v1/billing/total");
    assert.strictEqual(total.status, 200);
    assert.strictEqual(typeof total.body.totalStroops, "number");
    assert.ok(total.body.totalStroops >= 20);
    const unpriced = total.body.unpricedUsage as UnpricedUsage[];
    assert.ok(
      unpriced.some(
        (item) =>
          item.agent === missingAgent &&
          item.serviceId === missingService &&
          item.requests === 7
      )
    );
  });
});
