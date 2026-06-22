import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

const adminKey = "admin-test-key";
const adminHeaders = { "X-Admin-API-Key": adminKey };

process.env.ADMIN_API_KEY = adminKey;

beforeEach(async () => {
  process.env.ADMIN_API_KEY = adminKey;
  await request(app).post("/api/v1/admin/unpause").set(adminHeaders);
});

void describe("admin API key protection", () => {
  void it("keeps admin status and config reads public", async () => {
    const status = await request(app).get("/api/v1/admin/status");
    assert.strictEqual(status.status, 200);
    assert.strictEqual(typeof status.body.paused, "boolean");

    const config = await request(app).get("/api/v1/config");
    assert.strictEqual(config.status, 200);
    assert.strictEqual(typeof config.body.config.rateLimitPerWindow, "number");
  });

  void it("rejects missing and wrong admin keys on pause", async () => {
    const missing = await request(app).post("/api/v1/admin/pause");
    assert.strictEqual(missing.status, 401);
    assert.strictEqual(missing.body.error, "unauthorized");
    assert.ok(missing.body.requestId);

    const wrong = await request(app)
      .post("/api/v1/admin/pause")
      .set("X-Admin-API-Key", "wrong-key");
    assert.strictEqual(wrong.status, 401);
    assert.strictEqual(wrong.body.error, "unauthorized");
  });

  void it("allows pause and unpause with the correct admin key", async () => {
    const pause = await request(app).post("/api/v1/admin/pause").set(adminHeaders);
    assert.strictEqual(pause.status, 200);
    assert.strictEqual(pause.body.paused, true);

    const status = await request(app).get("/api/v1/admin/status");
    assert.strictEqual(status.body.paused, true);

    const unpause = await request(app).post("/api/v1/admin/unpause").set(adminHeaders);
    assert.strictEqual(unpause.status, 200);
    assert.strictEqual(unpause.body.paused, false);
  });

  void it("lets operators recover from pause only with the admin key", async () => {
    await request(app).post("/api/v1/admin/pause").set(adminHeaders);

    const blockedWrite = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "operator-test", serviceId: "svc", requests: 1 });
    assert.strictEqual(blockedWrite.status, 503);

    const missing = await request(app).post("/api/v1/admin/unpause");
    assert.strictEqual(missing.status, 401);

    const unpause = await request(app).post("/api/v1/admin/unpause").set(adminHeaders);
    assert.strictEqual(unpause.status, 200);
    assert.strictEqual(unpause.body.paused, false);
  });

  void it("protects config mutation and keeps validation behavior behind auth", async () => {
    const unauthenticated = await request(app)
      .patch("/api/v1/config")
      .send({ bulkMaxItems: 25 });
    assert.strictEqual(unauthenticated.status, 401);

    const invalid = await request(app)
      .patch("/api/v1/config")
      .set(adminHeaders)
      .send({ bulkMaxItems: 0 });
    assert.strictEqual(invalid.status, 400);
    assert.strictEqual(invalid.body.error, "invalid_request");

    const valid = await request(app)
      .patch("/api/v1/config")
      .set(adminHeaders)
      .send({ bulkMaxItems: 25 });
    assert.strictEqual(valid.status, 200);
    assert.strictEqual(valid.body.config.bulkMaxItems, 25);
  });

  void it("fails closed when ADMIN_API_KEY is not configured", async () => {
    const previous = process.env.ADMIN_API_KEY;
    delete process.env.ADMIN_API_KEY;

    try {
      const res = await request(app).post("/api/v1/admin/pause").set(adminHeaders);
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.body.error, "unauthorized");
    } finally {
      process.env.ADMIN_API_KEY = previous;
    }
  });
});
