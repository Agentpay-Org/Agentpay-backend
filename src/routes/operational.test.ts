import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "../index.js";
import { eventLog } from "../events.js";
import {
  apiKeyStore,
  config,
  pauseState,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
  webhookStore,
} from "../store/state.js";

const defaultConfig = {
  rateLimitPerWindow: 60,
  rateLimitWindowMs: 60_000,
  bulkMaxItems: 100,
  eventLogCap: 10_000,
};

beforeEach(() => {
  apiKeyStore.clear();
  eventLog.length = 0;
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  pauseState.paused = false;
  Object.assign(config, defaultConfig);
});

void describe("operational routes", () => {
  void it("reads and updates runtime config", async () => {
    const app = createApp();

    const initial = await request(app).get("/api/v1/config");
    assert.strictEqual(initial.status, 200);
    assert.strictEqual(initial.body.config.rateLimitPerWindow, 60);

    const updated = await request(app)
      .patch("/api/v1/config")
      .send({ rateLimitPerWindow: 75 });
    assert.strictEqual(updated.status, 200);
    assert.strictEqual(updated.body.config.rateLimitPerWindow, 75);

    const invalid = await request(app)
      .patch("/api/v1/config")
      .send({ bulkMaxItems: 0 });
    assert.strictEqual(invalid.status, 400);
    assert.strictEqual(invalid.body.error, "invalid_request");
  });

  void it("reports metrics, stats, deep health, changelog, and OpenAPI metadata", async () => {
    const app = createApp();
    servicesStore.set("svc-meta", { priceStroops: 10 });
    apiKeyStore.set("apk_abcdef", { label: "admin", createdAt: 1 });
    usageStore.set("agent-meta::svc-meta", 3);
    pauseState.paused = true;

    const metrics = await request(app).get("/api/v1/metrics");
    assert.strictEqual(metrics.status, 200);
    assert.ok(metrics.text.includes("agentpay_services_total 1"));
    assert.ok(metrics.text.includes("agentpay_paused 1"));

    const stats = await request(app).get("/api/v1/stats");
    assert.strictEqual(stats.status, 200);
    assert.strictEqual(stats.body.totalServices, 1);
    assert.strictEqual(stats.body.totalApiKeys, 1);
    assert.strictEqual(stats.body.totalRequests, 3);
    assert.strictEqual(stats.body.uniqueAgents, 1);
    assert.strictEqual(stats.body.paused, true);

    const deep = await request(app).get("/api/v1/health/deep");
    assert.strictEqual(deep.status, 200);
    assert.strictEqual(deep.body.status, "paused");

    const changelog = await request(app).get("/api/v1/changelog");
    assert.strictEqual(changelog.status, 200);
    assert.ok(Array.isArray(changelog.body.entries));

    const openapi = await request(app).get("/api/v1/openapi.json");
    assert.strictEqual(openapi.status, 200);
    assert.ok(openapi.body.paths["/api/v1/usage"]);
    assert.strictEqual(
      openapi.body.components.schemas.BillingQuote.properties.billedStroops.type,
      "string"
    );
    assert.strictEqual(
      openapi.body.components.schemas.BillingTotal.properties.totalStroops.type,
      "string"
    );
  });

  void it("creates, lists, and revokes API keys without exposing full keys on list", async () => {
    const app = createApp();

    const invalid = await request(app).post("/api/v1/api-keys").send({ label: "" });
    assert.strictEqual(invalid.status, 400);

    const created = await request(app).post("/api/v1/api-keys").send({ label: "ops" });
    assert.strictEqual(created.status, 201);
    const createdKey = created.body.key as unknown;
    if (typeof createdKey !== "string") {
      throw new TypeError("expected API key response to contain a string key");
    }
    assert.match(createdKey, /^apk_/);

    const listed = await request(app).get("/api/v1/api-keys");
    assert.strictEqual(listed.status, 200);
    assert.strictEqual(listed.body.items[0].label, "ops");
    assert.strictEqual(listed.body.items[0].prefix, createdKey.slice(0, 8));
    assert.strictEqual(listed.body.items[0].key, undefined);

    const missing = await request(app).delete("/api/v1/api-keys/notfound");
    assert.strictEqual(missing.status, 404);

    const revoked = await request(app).delete(
      `/api/v1/api-keys/${createdKey.slice(0, 8)}`
    );
    assert.strictEqual(revoked.status, 204);
  });

  void it("manages webhooks and records synthetic test events", async () => {
    const app = createApp();

    const bad = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "ftp://example.test", events: ["usage.recorded"] });
    assert.strictEqual(bad.status, 400);

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: ["usage.recorded"] });
    assert.strictEqual(created.status, 201);
    const webhookId = created.body.id as unknown;
    if (typeof webhookId !== "string") {
      throw new TypeError("expected webhook response to contain a string id");
    }

    const listed = await request(app).get("/api/v1/webhooks");
    assert.strictEqual(listed.status, 200);
    assert.strictEqual(listed.body.items[0].id, webhookId);

    const patched = await request(app)
      .patch(`/api/v1/webhooks/${webhookId}`)
      .send({ events: ["usage.settled"] });
    assert.strictEqual(patched.status, 200);
    assert.deepStrictEqual(patched.body.events, ["usage.settled"]);

    const badPatch = await request(app)
      .patch(`/api/v1/webhooks/${webhookId}`)
      .send({ url: "mailto:test@example.test" });
    assert.strictEqual(badPatch.status, 400);

    const badEvents = await request(app)
      .patch(`/api/v1/webhooks/${webhookId}`)
      .send({ events: [] });
    assert.strictEqual(badEvents.status, 400);

    const tested = await request(app).post(`/api/v1/webhooks/${webhookId}/test`);
    assert.strictEqual(tested.status, 200);
    assert.strictEqual(tested.body.simulated, true);

    const events = await request(app).get("/api/v1/events");
    assert.strictEqual(events.status, 200);
    assert.strictEqual(events.body.items[0].type, "webhook.test");

    const summary = await request(app).get("/api/v1/events/summary");
    assert.strictEqual(summary.status, 200);
    assert.strictEqual(summary.body.counts["webhook.test"], 1);

    const deleted = await request(app).delete(`/api/v1/webhooks/${webhookId}`);
    assert.strictEqual(deleted.status, 204);

    const missingDelete = await request(app).delete(`/api/v1/webhooks/${webhookId}`);
    assert.strictEqual(missingDelete.status, 404);

    const missingPatch = await request(app)
      .patch(`/api/v1/webhooks/${webhookId}`)
      .send({ url: "https://example.test/other" });
    assert.strictEqual(missingPatch.status, 404);

    const badCreateEvents = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: [] });
    assert.strictEqual(badCreateEvents.status, 400);

    const missing = await request(app).post(`/api/v1/webhooks/${webhookId}/test`);
    assert.strictEqual(missing.status, 404);
  });

  void it("reports service usage and top agents", async () => {
    const app = createApp();
    await request(app).post("/api/v1/services").send({
      serviceId: "svc-rollup",
      priceStroops: 1,
    });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-a", serviceId: "svc-rollup", requests: 3 });
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-b", serviceId: "svc-rollup", requests: 7 });

    const usage = await request(app).get("/api/v1/services/svc-rollup/usage");
    assert.strictEqual(usage.status, 200);
    assert.strictEqual(usage.body.total, 10);
    assert.strictEqual(usage.body.agents, 2);

    const top = await request(app).get(
      "/api/v1/services/svc-rollup/agents/top?limit=1"
    );
    assert.strictEqual(top.status, 200);
    assert.deepStrictEqual(top.body.items, [{ agent: "agent-b", total: 7 }]);

    const agents = await request(app).get("/api/v1/services/svc-rollup/agents");
    assert.strictEqual(agents.status, 200);
    assert.strictEqual(agents.body.items.length, 2);
  });

  void it("handles CORS preflight and oversized JSON bodies", async () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://allowed.example";
    const app = createApp();

    const preflight = await request(app)
      .options("/api/v1/usage")
      .set("Origin", "https://allowed.example");
    assert.strictEqual(preflight.status, 204);
    assert.strictEqual(
      preflight.headers["access-control-allow-origin"],
      "https://allowed.example"
    );

    const payloadTooLarge = await request(app)
      .post("/api/v1/usage")
      .send({ value: "x".repeat(101 * 1024) });
    assert.strictEqual(payloadTooLarge.status, 413);
    assert.strictEqual(payloadTooLarge.body.error, "payload_too_large");

    delete process.env.CORS_ALLOWED_ORIGINS;
  });
});
