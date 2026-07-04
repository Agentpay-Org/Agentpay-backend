import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "../index.js";
import { apiKeyStore, pauseState, usageStore } from "../store/state.js";

beforeEach(() => {
  apiKeyStore.clear();
  usageStore.clear();
  pauseState.paused = false;
  delete process.env.REQUIRE_API_KEY;
  delete process.env.ADMIN_API_KEY;
});

async function createTenantKey(): Promise<string> {
  const app = createApp();
  const created = await request(app).post("/api/v1/api-keys").send({ label: "tenant" });
  assert.strictEqual(created.status, 201);
  return readCreatedKey(created.body);
}

function readCreatedKey(body: unknown): string {
  const key =
    body && typeof body === "object" && "key" in body
      ? (body as { key: unknown }).key
      : undefined;
  if (typeof key !== "string") {
    throw new TypeError("expected API-key response to include a string key");
  }
  assert.match(key, /^apk_/);
  return key;
}

void describe("API key authentication", () => {
  void it("keeps write endpoints open when REQUIRE_API_KEY is disabled", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-open", serviceId: "svc-open", requests: 1 });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.total, 1);
  });

  void it("requires a valid tenant API key for state-changing non-admin routes", async () => {
    const key = await createTenantKey();
    process.env.REQUIRE_API_KEY = "true";
    const app = createApp();

    const read = await request(app).get("/api/v1/usage/agent-auth/svc-auth");
    assert.strictEqual(read.status, 200);

    const missing = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-auth", serviceId: "svc-auth", requests: 1 });
    assert.strictEqual(missing.status, 401);
    assert.strictEqual(missing.body.error, "unauthorized");
    assert.ok(missing.body.requestId);

    const unknown = await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", "apk_unknown")
      .send({ agent: "agent-auth", serviceId: "svc-auth", requests: 1 });
    assert.strictEqual(unknown.status, 401);
    assert.strictEqual(unknown.body.error, "unauthorized");
    assert.ok(unknown.body.requestId);

    const accepted = await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", key)
      .send({ agent: "agent-auth", serviceId: "svc-auth", requests: 2 });
    assert.strictEqual(accepted.status, 201);
    assert.strictEqual(accepted.body.total, 2);
  });

  void it("stores tenant API keys hashed and lists only the public prefix", async () => {
    const key = await createTenantKey();
    const prefix = key.slice(0, 8);

    assert.strictEqual(apiKeyStore.has(key), false);

    const listed = await request(createApp()).get("/api/v1/api-keys");
    assert.strictEqual(listed.status, 200);
    assert.strictEqual(listed.body.items.length, 1);
    assert.strictEqual(listed.body.items[0].prefix, prefix);
    assert.strictEqual(listed.body.items[0].key, undefined);
  });

  void it("requires ADMIN_API_KEY for API-key creation when enforcement is enabled", async () => {
    process.env.REQUIRE_API_KEY = "true";
    process.env.ADMIN_API_KEY = "admin-secret";
    const app = createApp();

    const missing = await request(app)
      .post("/api/v1/api-keys")
      .send({ label: "new-tenant" });
    assert.strictEqual(missing.status, 401);
    assert.strictEqual(missing.body.error, "unauthorized");

    const created = await request(app)
      .post("/api/v1/api-keys")
      .set("X-API-Key", "admin-secret")
      .send({ label: "new-tenant" });
    assert.strictEqual(created.status, 201);
    const key = readCreatedKey(created.body);
    assert.strictEqual(apiKeyStore.has(key), false);
  });

  void it("requires ADMIN_API_KEY instead of a tenant key for admin writes", async () => {
    const tenantKey = await createTenantKey();
    process.env.REQUIRE_API_KEY = "true";
    process.env.ADMIN_API_KEY = "admin-secret";
    const app = createApp();

    const status = await request(app).get("/api/v1/admin/status");
    assert.strictEqual(status.status, 200);

    const missing = await request(app).post("/api/v1/admin/pause");
    assert.strictEqual(missing.status, 401);
    assert.strictEqual(missing.body.error, "unauthorized");
    assert.ok(missing.body.requestId);

    const tenant = await request(app)
      .post("/api/v1/admin/pause")
      .set("X-API-Key", tenantKey);
    assert.strictEqual(tenant.status, 401);
    assert.strictEqual(tenant.body.error, "unauthorized");

    const wrongAdmin = await request(app)
      .post("/api/v1/admin/pause")
      .set("X-API-Key", "admin-wrong");
    assert.strictEqual(wrongAdmin.status, 401);
    assert.strictEqual(wrongAdmin.body.error, "unauthorized");

    const accepted = await request(app)
      .post("/api/v1/admin/pause")
      .set("X-API-Key", "admin-secret");
    assert.strictEqual(accepted.status, 200);
    assert.strictEqual(accepted.body.paused, true);
  });
});
