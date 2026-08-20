import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";
import { isReady, markShuttingDown, resetReadiness } from "./readiness.js";

void describe("readiness endpoint", () => {
  beforeEach(() => {
    resetReadiness();
  });

  void it("returns 200 with ready:true during normal operation", async () => {
    const res = await request(app).get("/api/v1/health/ready");
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { ready: true });
  });

  void it("returns 503 with ready:false after markShuttingDown is called", async () => {
    markShuttingDown();
    const res = await request(app).get("/api/v1/health/ready");
    assert.strictEqual(res.status, 503);
    assert.deepStrictEqual(res.body, { ready: false });
  });

  void it("transitions from ready to not-ready after shutdown begins", async () => {
    const before = await request(app).get("/api/v1/health/ready");
    assert.strictEqual(before.status, 200);
    assert.strictEqual(before.body.ready, true);

    markShuttingDown();

    const after = await request(app).get("/api/v1/health/ready");
    assert.strictEqual(after.status, 503);
    assert.strictEqual(after.body.ready, false);
  });

  void it("keeps liveness probe at 200 even after shutdown begins", async () => {
    markShuttingDown();

    const liveness = await request(app).get("/health");
    assert.strictEqual(liveness.status, 200);
    assert.strictEqual(liveness.body.status, "ok");
    assert.strictEqual(liveness.body.service, "agentpay-backend");

    const readiness = await request(app).get("/api/v1/health/ready");
    assert.strictEqual(readiness.status, 503);
    assert.strictEqual(readiness.body.ready, false);
  });

  void it("does not leak internal details beyond the ready boolean", async () => {
    const res = await request(app).get("/api/v1/health/ready");
    assert.strictEqual(res.status, 200);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- supertest body is typed any
    assert.deepStrictEqual(Object.keys(res.body), ["ready"]);
    assert.strictEqual(typeof res.body.ready, "boolean");
  });

  void it("readiness flag is independent from admin pause state", async () => {
    await request(app).post("/api/v1/admin/pause");
    
    const readiness = await request(app).get("/api/v1/health/ready");
    assert.strictEqual(readiness.status, 200);
    assert.strictEqual(readiness.body.ready, true);

    const deep = await request(app).get("/api/v1/health/deep");
    assert.strictEqual(deep.status, 200);
    assert.strictEqual(deep.body.status, "paused");

    await request(app).post("/api/v1/admin/unpause");
  });

  void it("readiness flag affects only readiness, not deep health status", async () => {
    markShuttingDown();

    const ready = await request(app).get("/api/v1/health/ready");
    assert.strictEqual(ready.status, 503);
    assert.strictEqual(ready.body.ready, false);

    const deep = await request(app).get("/api/v1/health/deep");
    assert.strictEqual(deep.status, 200);
    assert.strictEqual(deep.body.status, "ok");
  });

  void it("isReady() returns true before shutdown", () => {
    assert.strictEqual(isReady(), true);
  });

  void it("isReady() returns false after markShuttingDown()", () => {
    markShuttingDown();
    assert.strictEqual(isReady(), false);
  });

  void it("resetReadiness() restores ready state for tests", () => {
    markShuttingDown();
    assert.strictEqual(isReady(), false);
    
    resetReadiness();
    assert.strictEqual(isReady(), true);
  });

  void it("multiple calls to markShuttingDown() are safe", () => {
    markShuttingDown();
    markShuttingDown();
    markShuttingDown();
    assert.strictEqual(isReady(), false);
  });

  void it("attaches X-Request-Id to readiness responses", async () => {
    const res = await request(app).get("/api/v1/health/ready");
    assert.strictEqual(res.status, 200);
    const id = res.headers["x-request-id"];
    assert.ok(typeof id === "string" && id.length > 0);
  });

  void it("echoes caller-provided X-Request-Id on readiness endpoint", async () => {
    const caller = "readiness-trace-123";
    const res = await request(app)
      .get("/api/v1/health/ready")
      .set("X-Request-Id", caller);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["x-request-id"], caller);
  });
});
