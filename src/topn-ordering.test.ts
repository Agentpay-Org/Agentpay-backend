import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { usageKey, usageStore } from "./store/state.js";

const app = createApp();

beforeEach(() => {
  usageStore.clear();
});

function seedUsage(agent: string, serviceId: string, total: number): void {
  usageStore.set(usageKey(agent, serviceId), total);
}

void describe("service agent ordering", () => {
  void it("breaks equal-total ties by agent id on the top-N endpoint", async () => {
    seedUsage("zeta", "svc-stable", 1);
    seedUsage("alpha", "svc-stable", 1);
    seedUsage("beta", "svc-stable", 1);
    seedUsage("omega", "svc-stable", 3);

    const top = await request(app).get(
      "/api/v1/services/svc-stable/agents/top?limit=3"
    );

    assert.strictEqual(top.status, 200);
    assert.deepStrictEqual(top.body.items, [
      { agent: "omega", total: 3 },
      { agent: "alpha", total: 1 },
      { agent: "beta", total: 1 },
    ]);
  });

  void it("uses the same deterministic ordering on the full agent list", async () => {
    seedUsage("zeta", "svc-stable", 1);
    seedUsage("alpha", "svc-stable", 1);
    seedUsage("beta", "svc-stable", 1);
    seedUsage("omega", "svc-stable", 3);

    const listed = await request(app).get("/api/v1/services/svc-stable/agents");

    assert.strictEqual(listed.status, 200);
    assert.deepStrictEqual(listed.body.items, [
      { agent: "omega", total: 3 },
      { agent: "alpha", total: 1 },
      { agent: "beta", total: 1 },
      { agent: "zeta", total: 1 },
    ]);
  });
});
