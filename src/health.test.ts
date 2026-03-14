import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

describe("AgentPay Backend", () => {
  it("app is defined", () => {
    assert.ok(app);
  });

  it("health endpoint returns 200 and status ok", async () => {
    const res = await request(app).get("/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body?.status, "ok");
    assert.strictEqual(res.body?.service, "agentpay-backend");
  });

  it("version endpoint returns version", async () => {
    const res = await request(app).get("/api/v1/version");
    assert.strictEqual(res.status, 200);
    assert.ok(res.body?.version);
  });
});
