import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { eventLog } from "./events.js";
import {
  apiKeyStore,
  config,
  pauseState,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
  webhookStore,
} from "./store/state.js";

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

void describe("webhook endpoint coverage", () => {
  void it("covers the webhook success path end to end", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: ["usage.recorded"] });
    assert.strictEqual(created.status, 201);
    const id = created.body.id as unknown;
    if (typeof id !== "string") {
      throw new TypeError("expected webhook id");
    }

    const listed = await request(app).get("/api/v1/webhooks");
    assert.strictEqual(listed.status, 200);
    assert.strictEqual(listed.body.items.length, 1);
    assert.strictEqual(listed.body.items[0].id, id);

    const patched = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ events: ["usage.settled"] });
    assert.strictEqual(patched.status, 200);
    assert.deepStrictEqual(patched.body.events, ["usage.settled"]);

    const tested = await request(app).post(`/api/v1/webhooks/${id}/test`);
    assert.strictEqual(tested.status, 200);
    assert.strictEqual(tested.body.id, id);
    assert.strictEqual(tested.body.simulated, true);
    assert.strictEqual(eventLog[0]?.type, "webhook.test");

    const deleted = await request(app).delete(`/api/v1/webhooks/${id}`);
    assert.strictEqual(deleted.status, 204);
  });

  void it("returns not-found and repeat-operation errors consistently", async () => {
    const app = createApp();

    const missing = await request(app)
      .get("/api/v1/webhooks/wh_missing")
      .set("X-Request-Id", "missing-webhook");
    assert.strictEqual(missing.status, 404);
    assert.strictEqual(missing.body.error, "not_found");
    assert.strictEqual(missing.body.message, "webhook wh_missing not registered");
    assert.strictEqual(missing.body.requestId, "missing-webhook");

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: ["usage.recorded"] });
    assert.strictEqual(created.status, 201);
    const id = created.body.id as unknown;
    if (typeof id !== "string") {
      throw new TypeError("expected webhook id");
    }

    const deleted = await request(app).delete(`/api/v1/webhooks/${id}`);
    assert.strictEqual(deleted.status, 204);

    const repeatedDelete = await request(app).delete(`/api/v1/webhooks/${id}`);
    assert.strictEqual(repeatedDelete.status, 404);
    assert.strictEqual(repeatedDelete.body.error, "not_found");

    const repeatedPatch = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ url: "https://example.test/updated" });
    assert.strictEqual(repeatedPatch.status, 404);
    assert.strictEqual(repeatedPatch.body.error, "not_found");

    const repeatedTest = await request(app).post(`/api/v1/webhooks/${id}/test`);
    assert.strictEqual(repeatedTest.status, 404);
    assert.strictEqual(repeatedTest.body.error, "not_found");
  });

  void it("rejects invalid create and patch payloads", async () => {
    const app = createApp();

    const badCreate = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "ftp://example.test/hook", events: ["usage.recorded"] });
    assert.strictEqual(badCreate.status, 400);
    assert.strictEqual(badCreate.body.error, "invalid_request");

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: ["usage.recorded"] });
    assert.strictEqual(created.status, 201);
    const id = created.body.id as unknown;
    if (typeof id !== "string") {
      throw new TypeError("expected webhook id");
    }

    const badPatch = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ url: "mailto:test@example.test" });
    assert.strictEqual(badPatch.status, 400);
    assert.strictEqual(badPatch.body.error, "invalid_request");

    const emptyPatch = await request(app).patch(`/api/v1/webhooks/${id}`).send({});
    assert.strictEqual(emptyPatch.status, 400);
    assert.strictEqual(emptyPatch.body.error, "invalid_request");
  });

  void it("returns an empty result when no webhooks exist", async () => {
    const app = createApp();

    const listed = await request(app).get("/api/v1/webhooks");
    assert.strictEqual(listed.status, 200);
    assert.deepStrictEqual(listed.body.items, []);
    assert.strictEqual(listed.body.total, 0);
  });
});
