import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "../index.js";
import { apiKeyMatchesHash, hashApiKey, secureStringEqual } from "./apiKeys.js";

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function createApiKey(label = unique("auth-label")) {
  const previous = process.env.REQUIRE_API_KEY;
  delete process.env.REQUIRE_API_KEY;
  const res = await request(app).post("/api/v1/api-keys").send({ label });
  if (previous === undefined) delete process.env.REQUIRE_API_KEY;
  else process.env.REQUIRE_API_KEY = previous;
  assert.strictEqual(res.status, 201);
  assert.strictEqual(typeof res.body.key, "string");
  return res.body.key as string;
}

void describe("API key authentication", () => {
  void it("hashes API keys and compares them without exposing the raw key", () => {
    const key = "apk_test_secret";
    const hash = hashApiKey(key);

    assert.notStrictEqual(hash, key);
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.strictEqual(apiKeyMatchesHash(key, hash), true);
    assert.strictEqual(apiKeyMatchesHash("wrong", hash), false);
    assert.strictEqual(secureStringEqual(key, key), true);
    assert.strictEqual(secureStringEqual("wrong", key), false);
  });

  void it("keeps writes open when REQUIRE_API_KEY is not true", async () => {
    delete process.env.REQUIRE_API_KEY;
    const serviceId = unique("auth-open-service");

    const res = await request(app)
      .post("/api/v1/services")
      .send({ serviceId, priceStroops: 1 });

    assert.strictEqual(res.status, 201);
  });

  void it("rejects missing and unknown tenant keys when enforcement is enabled", async () => {
    process.env.REQUIRE_API_KEY = "true";

    const missing = await request(app)
      .post("/api/v1/usage")
      .set("X-Request-Id", "missing-key-request")
      .send({ agent: "a", serviceId: "s", requests: 1 });
    assert.strictEqual(missing.status, 401);
    assert.deepStrictEqual(missing.body, {
      error: "unauthorized",
      message: "valid API key required",
      requestId: "missing-key-request",
    });

    const unknown = await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", "apk_unknown")
      .send({ agent: "a", serviceId: "s", requests: 1 });
    assert.strictEqual(unknown.status, 401);

    delete process.env.REQUIRE_API_KEY;
  });

  void it("accepts a valid tenant key on write endpoints", async () => {
    const key = await createApiKey();
    process.env.REQUIRE_API_KEY = "true";

    const serviceId = unique("auth-valid-service");
    const res = await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", key)
      .send({ serviceId, priceStroops: 3 });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.serviceId, serviceId);
    delete process.env.REQUIRE_API_KEY;
  });

  void it("requires ADMIN_API_KEY for privileged admin writes", async () => {
    const tenantKey = await createApiKey();
    process.env.REQUIRE_API_KEY = "true";
    process.env.ADMIN_API_KEY = "admin-secret";

    const tenantAttempt = await request(app)
      .post("/api/v1/admin/pause")
      .set("X-API-Key", tenantKey);
    assert.strictEqual(tenantAttempt.status, 401);
    assert.strictEqual(tenantAttempt.body.error, "unauthorized");

    const adminAttempt = await request(app)
      .post("/api/v1/admin/pause")
      .set("X-API-Key", "admin-secret");
    assert.strictEqual(adminAttempt.status, 200);
    assert.deepStrictEqual(adminAttempt.body, { paused: true });

    const unpause = await request(app)
      .post("/api/v1/admin/unpause")
      .set("X-API-Key", "admin-secret");
    assert.strictEqual(unpause.status, 200);

    delete process.env.REQUIRE_API_KEY;
    delete process.env.ADMIN_API_KEY;
  });

  void it("keeps API key listings prefix-only", async () => {
    const key = await createApiKey("prefix-only");

    const res = await request(app).get("/api/v1/api-keys");
    assert.strictEqual(res.status, 200);
    const match = (res.body.items as { prefix: string; label: string }[]).find(
      (item) => item.prefix === key.slice(0, 8)
    );
    assert.ok(match);
    assert.strictEqual(match.label, "prefix-only");
    assert.strictEqual(JSON.stringify(res.body).includes(key), false);
  });
});
