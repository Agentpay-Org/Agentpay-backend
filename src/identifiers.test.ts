import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

const validAgent = "agent_Alpha-01.test";
const validService = "service_Alpha-01.test";

beforeEach(async () => {
  await request(app).post("/api/v1/admin/unpause");
});

function assertInvalidRequest(res: request.Response) {
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, "invalid_request");
  assert.ok(res.body.message);
  assert.ok(res.body.requestId);
}

void describe("identifier validation", () => {
  void it("accepts safe agent and serviceId characters on usage writes and reads", async () => {
    const write = await request(app)
      .post("/api/v1/usage")
      .send({ agent: validAgent, serviceId: validService, requests: 2 });
    assert.strictEqual(write.status, 201);

    const read = await request(app).get(
      `/api/v1/usage/${encodeURIComponent(validAgent)}/${encodeURIComponent(validService)}`
    );
    assert.strictEqual(read.status, 200);
    assert.deepStrictEqual(read.body, {
      agent: validAgent,
      serviceId: validService,
      total: 2,
    });
  });

  for (const [label, agent] of [
    ["separator", "agent::evil"],
    ["newline", "agent\nrow"],
    ["tab", "agent\tcell"],
    ["comma", "agent,cell"],
    ["whitespace-only", "   "],
  ] as const) {
    void it(`POST /api/v1/usage rejects agent containing ${label}`, async () => {
      const res = await request(app)
        .post("/api/v1/usage")
        .send({ agent, serviceId: validService, requests: 1 });
      assertInvalidRequest(res);
    });
  }

  for (const [label, serviceId] of [
    ["separator", "service::evil"],
    ["newline", "service\nrow"],
    ["control char", "service\u0001id"],
    ["comma", "service,cell"],
    ["whitespace-only", "   "],
  ] as const) {
    void it(`POST /api/v1/services rejects serviceId containing ${label}`, async () => {
      const res = await request(app)
        .post("/api/v1/services")
        .send({ serviceId, priceStroops: 1 });
      assertInvalidRequest(res);
    });
  }

  void it("marks unsafe identifiers as invalid items in bulk usage and service registration", async () => {
    const usage = await request(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "safe-agent", serviceId: "safe-service", requests: 1 },
          { agent: "bad::agent", serviceId: "safe-service", requests: 1 },
        ],
      });
    assert.strictEqual(usage.status, 201);
    assert.deepStrictEqual(
      usage.body.results.map((result: { ok: boolean; error?: string }) => ({
        ok: result.ok,
        error: result.error,
      })),
      [
        { ok: true, error: undefined },
        { ok: false, error: "invalid_item" },
      ]
    );

    const services = await request(app)
      .post("/api/v1/services/bulk")
      .send({
        items: [
          { serviceId: "safe-service", priceStroops: 1 },
          { serviceId: "bad\nservice", priceStroops: 1 },
        ],
      });
    assert.strictEqual(services.status, 201);
    assert.deepStrictEqual(
      services.body.results.map((result: { ok: boolean; error?: string }) => ({
        ok: result.ok,
        error: result.error,
      })),
      [
        { ok: true, error: undefined },
        { ok: false, error: "invalid_item" },
      ]
    );
  });

  void it("rejects unsafe identifiers in settlement and path-param read routes", async () => {
    const settle = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "bad::agent", serviceId: validService });
    assertInvalidRequest(settle);

    for (const path of [
      `/api/v1/usage/${encodeURIComponent("bad::agent")}/${validService}`,
      `/api/v1/billing/${validAgent}/${encodeURIComponent("bad\nservice")}`,
      `/api/v1/agents/${encodeURIComponent("bad,agent")}/total`,
      `/api/v1/agents/${encodeURIComponent("bad\tagent")}/usage`,
      `/api/v1/services/${encodeURIComponent("bad::service")}`,
      `/api/v1/services/${encodeURIComponent("bad\nservice")}/usage`,
      `/api/v1/services/${encodeURIComponent("bad\tservice")}/agents/top`,
      `/api/v1/services/${encodeURIComponent("bad,service")}/agents`,
      `/api/v1/services/${encodeURIComponent("bad::service")}/metadata`,
    ]) {
      const res = await request(app).get(path);
      assertInvalidRequest(res);
    }
  });

  void it("preserves existing length caps", async () => {
    const tooLongAgent = "a".repeat(257);
    const tooLongService = "s".repeat(129);

    assertInvalidRequest(
      await request(app)
        .post("/api/v1/usage")
        .send({ agent: tooLongAgent, serviceId: validService, requests: 1 })
    );
    assertInvalidRequest(
      await request(app)
        .post("/api/v1/services")
        .send({ serviceId: tooLongService, priceStroops: 1 })
    );
  });
});
