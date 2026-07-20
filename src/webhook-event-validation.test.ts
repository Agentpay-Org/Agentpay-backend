import { describe, it, beforeEach } from "node:test";
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

void describe("Webhook Event Taxonomy Validation", () => {
  void it("accepts known event types on register and patch", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: ["usage.recorded", "usage.settled", "webhook.test"] });
    assert.strictEqual(created.status, 201);
    
    const id = created.body.id as string;

    const patched = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ events: ["usage.recorded"] });
    assert.strictEqual(patched.status, 200);
  });

  void it("accepts the wildcard event type on register and patch", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: ["*"] });
    assert.strictEqual(created.status, 201);
    
    const id = created.body.id as string;

    const patched = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ events: ["*"] });
    assert.strictEqual(patched.status, 200);
  });

  void it("rejects unknown event types on register and patch", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: ["completely.made.up"] });
    assert.strictEqual(created.status, 400);
    assert.strictEqual(created.body.error, "invalid_request");
    assert.strictEqual(created.body.message, "unknown event type: completely.made.up");

    // create a valid one to patch
    const valid = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: ["*"] });
    assert.strictEqual(valid.status, 201);
    
    const id = valid.body.id as string;

    const patched = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ events: ["usage.recordd"] });
    assert.strictEqual(patched.status, 400);
    assert.strictEqual(patched.body.error, "invalid_request");
    assert.strictEqual(patched.body.message, "unknown event type: usage.recordd");
  });

  void it("rejects mixed valid and invalid array of event types", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: ["usage.recorded", "unknown.event"] });
    assert.strictEqual(created.status, 400);
    assert.strictEqual(created.body.error, "invalid_request");
    assert.strictEqual(created.body.message, "unknown event type: unknown.event");
  });

  void it("rejects empty array of event types", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: [] });
    assert.strictEqual(created.status, 400);
    assert.strictEqual(created.body.error, "invalid_request");
    assert.strictEqual(created.body.message, "events must be a non-empty array of strings");
  });
});
