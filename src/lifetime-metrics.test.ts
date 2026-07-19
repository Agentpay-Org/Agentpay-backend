import { strict as assert } from "node:assert";
import { describe, it, beforeEach } from "node:test";
import * as state from "./store/state.js";
import { app } from "./index.js";
import supertest from "supertest";

void describe("lifetime-metrics", () => {
  beforeEach(() => {
    state.usageStore.clear();
    state.resetLifetimeRequests();
  });

  void it("increments lifetimeRequests on record", async () => {
    await supertest(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc-a", requests: 5 });
    
    assert.strictEqual(state.lifetimeRequests, 5);
  });

  void it("keeps lifetimeRequests after settlement drains outstanding usage", async () => {
    await supertest(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc-a", requests: 5 });
    
    await supertest(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-a", serviceId: "svc-a" });
    
    assert.strictEqual(state.lifetimeRequests, 5);
    assert.strictEqual(state.usageStore.get("agent-a::svc-a"), 0);
  });

  void it("increments lifetimeRequests for each valid bulk usage item", async () => {
    await supertest(app)
      .post("/api/v1/usage/bulk")
      .send({
        items: [
          { agent: "agent-a", serviceId: "svc-a", requests: 3 },
          { agent: "agent-b", serviceId: "svc-b", requests: 4 },
        ],
      });
    
    assert.strictEqual(state.lifetimeRequests, 7);
  });

  void it("exposes lifetimeRequests in /stats", async () => {
    await supertest(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc-a", requests: 5 });
    
    const response = await supertest(app).get("/api/v1/stats");
    assert.strictEqual(response.body.lifetimeRequests, 5);
  });

  void it("exposes agentpay_requests_recorded_total in /metrics", async () => {
    await supertest(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc-a", requests: 5 });
    
    const response = await supertest(app).get("/api/v1/metrics");
    assert.match(response.text, /agentpay_requests_recorded_total 5/);
  });
});
