import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";
import { resetReadiness, markShuttingDown } from "./readiness.js";
import { pauseState } from "./store/state.js";

void describe("readiness probe", () => {
  beforeEach(() => {
    resetReadiness();
    pauseState.paused = false;
  });

  void it("returns ready true before shutdown begins", async () => {
    const res = await request(app).get("/api/v1/health/ready");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { ready: true });
  });

  void it("returns ready false once shutdown drain begins", async () => {
    markShuttingDown();

    const res = await request(app).get("/api/v1/health/ready");

    assert.strictEqual(res.status, 503);
    assert.deepStrictEqual(res.body, { ready: false });
  });

  void it("keeps liveness healthy during shutdown drain", async () => {
    markShuttingDown();

    const res = await request(app).get("/health");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, {
      status: "ok",
      service: "agentpay-backend",
    });
  });

  void it("keeps readiness independent from the admin pause flag", async () => {
    await request(app).post("/api/v1/admin/pause");

    const res = await request(app).get("/api/v1/health/ready");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { ready: true });
  });
});
