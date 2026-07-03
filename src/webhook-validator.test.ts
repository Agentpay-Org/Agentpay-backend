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
import { validateWebhookEvents, validateWebhookUrl } from "./routes/webhooks.js";

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

void describe("shared webhook validation", () => {
  void it("validates webhook URLs and events through shared helpers", () => {
    assert.deepStrictEqual(validateWebhookUrl("https://example.test/hook"), {
      ok: true,
      value: "https://example.test/hook",
    });
    assert.deepStrictEqual(validateWebhookUrl("ftp://example.test/hook"), {
      ok: false,
      message: "url must be an http(s) URL up to 2048 chars",
    });

    assert.deepStrictEqual(validateWebhookEvents(["usage.recorded"]), {
      ok: true,
      value: ["usage.recorded"],
    });
    assert.deepStrictEqual(validateWebhookEvents([]), {
      ok: false,
      message: "events must be a non-empty array of strings",
    });
    assert.deepStrictEqual(validateWebhookEvents(["usage.recorded", 42]), {
      ok: false,
      message: "events must be a non-empty array of strings",
    });
  });

  void it("uses the same URL and event errors for webhook create and patch", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: ["usage.recorded"] });
    assert.strictEqual(created.status, 201);
    const id = created.body.id as unknown;
    if (typeof id !== "string") {
      throw new TypeError("expected webhook id");
    }

    const createBadUrl = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "mailto:ops@example.test", events: ["usage.recorded"] });
    const patchBadUrl = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ url: "mailto:ops@example.test" });
    assert.strictEqual(createBadUrl.status, 400);
    assert.strictEqual(patchBadUrl.status, 400);
    assert.strictEqual(createBadUrl.body.error, "invalid_request");
    assert.strictEqual(patchBadUrl.body.error, "invalid_request");
    assert.strictEqual(createBadUrl.body.message, patchBadUrl.body.message);
    assert.strictEqual(
      createBadUrl.body.message,
      "url must be an http(s) URL up to 2048 chars"
    );

    const createBadEvents = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: [] });
    const patchBadEvents = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ events: [] });
    assert.strictEqual(createBadEvents.status, 400);
    assert.strictEqual(patchBadEvents.status, 400);
    assert.strictEqual(createBadEvents.body.error, "invalid_request");
    assert.strictEqual(patchBadEvents.body.error, "invalid_request");
    assert.strictEqual(createBadEvents.body.message, patchBadEvents.body.message);
    assert.strictEqual(
      createBadEvents.body.message,
      "events must be a non-empty array of strings"
    );
  });

  void it("keeps webhook patch partial-update semantics", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({ url: "https://example.test/hook", events: ["usage.recorded"] });
    assert.strictEqual(created.status, 201);
    const id = created.body.id as unknown;
    if (typeof id !== "string") {
      throw new TypeError("expected webhook id");
    }

    const eventsOnly = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ events: ["usage.settled"] });
    assert.strictEqual(eventsOnly.status, 200);
    assert.strictEqual(eventsOnly.body.url, "https://example.test/hook");
    assert.deepStrictEqual(eventsOnly.body.events, ["usage.settled"]);

    const urlOnly = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ url: "https://example.test/updated" });
    assert.strictEqual(urlOnly.status, 200);
    assert.strictEqual(urlOnly.body.url, "https://example.test/updated");
    assert.deepStrictEqual(urlOnly.body.events, ["usage.settled"]);
  });
});
