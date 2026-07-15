import assert from "node:assert";
import { describe, it } from "node:test";
import request from "supertest";
import { app } from "./index.js";

void describe("agent and service identifier validation", () => {
  void it("rejects unsafe single usage identifiers", async () => {
    const badAgent = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "bad::agent", serviceId: "safe-service", requests: 1 });

    const badService = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "safe-agent", serviceId: "bad\nservice", requests: 1 });

    assert.strictEqual(badAgent.status, 400);
    assert.strictEqual(badAgent.body.error, "invalid_request");
    assert.strictEqual(badService.status, 400);
    assert.strictEqual(badService.body.error, "invalid_request");
  });

  void it("marks unsafe bulk usage and service entries invalid", async () => {
    const usage = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "bad::agent", serviceId: "safe-service", requests: 1 },
          { agent: "safe-agent", serviceId: "bad service", requests: 1 },
        ],
      });

    const services = await request(app)
      .post("/api/v1/services/bulk")
      .send({
        items: [
          { serviceId: "bad::service", priceStroops: 1 },
          { serviceId: "safe-service", priceStroops: 1 },
        ],
      });

    assert.strictEqual(usage.status, 201);
    assert.deepStrictEqual(
      usage.body.results.map((item: { ok: boolean; error?: string }) => ({
        ok: item.ok,
        error: item.error,
      })),
      [
        { ok: false, error: "invalid_item" },
        { ok: false, error: "invalid_item" },
      ]
    );

    assert.strictEqual(services.status, 201);
    assert.strictEqual(services.body.results[0].ok, false);
    assert.strictEqual(services.body.results[0].error, "invalid_item");
    assert.strictEqual(services.body.results[1].ok, true);
  });

  void it("rejects unsafe settlement and path identifiers", async () => {
    const settle = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "bad::agent", serviceId: "safe-service" });

    const usageRead = await request(app).get("/api/v1/usage/bad::agent/safe-service");
    const agentTotal = await request(app).get("/api/v1/agents/bad::agent/total");
    const serviceRead = await request(app).get("/api/v1/services/bad::service");

    assert.strictEqual(settle.status, 400);
    assert.strictEqual(settle.body.error, "invalid_request");
    assert.strictEqual(usageRead.status, 400);
    assert.strictEqual(usageRead.body.error, "invalid_request");
    assert.strictEqual(agentTotal.status, 400);
    assert.strictEqual(agentTotal.body.error, "invalid_request");
    assert.strictEqual(serviceRead.status, 400);
    assert.strictEqual(serviceRead.body.error, "invalid_request");
  });

  void it("accepts safe identifier characters", async () => {
    const created = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent_1.2-3", serviceId: "service_1.2-3", requests: 1 });

    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.agent, "agent_1.2-3");
    assert.strictEqual(created.body.serviceId, "service_1.2-3");
  });
});
