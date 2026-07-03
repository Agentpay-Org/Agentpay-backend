import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import {
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
} from "./store/state.js";

beforeEach(() => {
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
});

afterEach(() => {
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
});

void describe("service usage agent counts", () => {
  void it("counts non-zero outstanding agents consistently with the service agent list", async () => {
    const app = createApp();

    await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-rollup", priceStroops: 5 });
    await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-other", priceStroops: 5 });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-active", serviceId: "svc-rollup", requests: 3 });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-settled", serviceId: "svc-rollup", requests: 2 });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-other", serviceId: "svc-other", requests: 7 });
    await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-settled", serviceId: "svc-rollup" });

    const usage = await request(app).get("/api/v1/services/svc-rollup/usage");
    const agents = await request(app).get("/api/v1/services/svc-rollup/agents");

    assert.strictEqual(usage.status, 200);
    assert.strictEqual(agents.status, 200);
    assert.strictEqual(usage.body.total, 3);
    assert.strictEqual(usage.body.agents, 1);
    assert.strictEqual(usage.body.agents, agents.body.items.length);
    assert.deepStrictEqual(agents.body.items, [{ agent: "agent-active", total: 3 }]);
  });
});
