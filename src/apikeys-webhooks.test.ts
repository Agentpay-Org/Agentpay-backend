import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { eventLog } from "./events.js";
import { createApp } from "./index.js";
import { apiKeyStore, webhookStore } from "./store/state.js";

function urlWithLength(length: number): string {
  const prefix = "https://example.test/";
  return `${prefix}${"a".repeat(length - prefix.length)}`;
}

function assertInvalidRequest(body: unknown): void {
  if (body === null || typeof body !== "object") {
    throw new TypeError("expected response body object");
  }
  const record = body as Record<string, unknown>;
  assert.strictEqual(record.error, "invalid_request");
  if (typeof record.requestId !== "string") {
    throw new TypeError("expected requestId string");
  }
  const requestId = record.requestId;
  assert.ok(requestId.length > 0);
}

beforeEach(() => {
  apiKeyStore.clear();
  webhookStore.clear();
  eventLog.length = 0;
});

void describe("API-key lifecycle coverage", () => {
  void it("creates, lists, and revokes keys without listing the full secret", async () => {
    const app = createApp();

    const created = await request(app).post("/api/v1/api-keys").send({ label: "ops" });
    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.label, "ops");
    const key = created.body.key as unknown;
    if (typeof key !== "string") {
      throw new TypeError("expected generated API key");
    }
    assert.match(key, /^apk_/);

    const listed = await request(app).get("/api/v1/api-keys");
    assert.strictEqual(listed.status, 200);
    assert.strictEqual(listed.body.items.length, 1);
    assert.strictEqual(listed.body.items[0].prefix, key.slice(0, 8));
    assert.strictEqual(listed.body.items[0].label, "ops");
    assert.strictEqual(listed.body.items[0].key, undefined);
    assert.ok(!JSON.stringify(listed.body).includes(key));

    const revoked = await request(app).delete(`/api/v1/api-keys/${key.slice(0, 8)}`);
    assert.strictEqual(revoked.status, 204);

    const missing = await request(app).delete(`/api/v1/api-keys/${key.slice(0, 8)}`);
    assert.strictEqual(missing.status, 404);
    assert.strictEqual(missing.body.error, "not_found");
    assert.strictEqual(typeof missing.body.requestId, "string");
  });

  for (const [label, payload] of [
    ["missing label", {}],
    ["empty label", { label: "" }],
    ["too-long label", { label: "x".repeat(65) }],
  ] as const) {
    void it(`rejects API-key create with ${label}`, async () => {
      const app = createApp();

      const response = await request(app).post("/api/v1/api-keys").send(payload);

      assert.strictEqual(response.status, 400);
      assertInvalidRequest(response.body as unknown);
    });
  }
});

void describe("webhook CRUD coverage", () => {
  void it("registers, lists, patches, tests, and deletes a webhook", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({
        url: "https://example.test/hook",
        events: ["usage.recorded"],
      });
    assert.strictEqual(created.status, 201);
    const id = created.body.id as unknown;
    if (typeof id !== "string") {
      throw new TypeError("expected webhook id");
    }

    const listed = await request(app).get("/api/v1/webhooks");
    assert.strictEqual(listed.status, 200);
    assert.strictEqual(listed.body.items[0].id, id);
    assert.strictEqual(listed.body.items[0].url, "https://example.test/hook");

    const patchedUrl = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ url: "https://example.test/other" });
    assert.strictEqual(patchedUrl.status, 200);
    assert.strictEqual(patchedUrl.body.url, "https://example.test/other");
    assert.deepStrictEqual(patchedUrl.body.events, ["usage.recorded"]);

    const patchedEvents = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({ events: ["usage.settled"] });
    assert.strictEqual(patchedEvents.status, 200);
    assert.strictEqual(patchedEvents.body.url, "https://example.test/other");
    assert.deepStrictEqual(patchedEvents.body.events, ["usage.settled"]);

    const tested = await request(app).post(`/api/v1/webhooks/${id}/test`);
    assert.strictEqual(tested.status, 200);
    assert.strictEqual(tested.body.id, id);
    assert.strictEqual(tested.body.simulated, true);
    assert.strictEqual(eventLog[0]?.type, "webhook.test");

    const deleted = await request(app).delete(`/api/v1/webhooks/${id}`);
    assert.strictEqual(deleted.status, 204);

    const missingDelete = await request(app).delete(`/api/v1/webhooks/${id}`);
    assert.strictEqual(missingDelete.status, 404);
    assert.strictEqual(missingDelete.body.error, "not_found");

    const missingTest = await request(app).post(`/api/v1/webhooks/${id}/test`);
    assert.strictEqual(missingTest.status, 404);
    assert.strictEqual(missingTest.body.error, "not_found");
  });

  void it("accepts an http(s) webhook URL up to 2048 characters", async () => {
    const app = createApp();
    const maxUrl = urlWithLength(2048);

    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({
        url: maxUrl,
        events: ["usage.recorded"],
      });

    assert.strictEqual(created.status, 201);
    assert.strictEqual(created.body.url, maxUrl);
  });

  for (const [label, payload] of [
    ["missing url", { events: ["usage.recorded"] }],
    ["non-http url", { url: "ftp://example.test/hook", events: ["usage.recorded"] }],
    ["too-long url", { url: urlWithLength(2049), events: ["usage.recorded"] }],
    ["empty events", { url: "https://example.test/hook", events: [] }],
    ["non-string event", { url: "https://example.test/hook", events: [7] }],
  ] as const) {
    void it(`rejects webhook create with ${label}`, async () => {
      const app = createApp();

      const response = await request(app).post("/api/v1/webhooks").send(payload);

      assert.strictEqual(response.status, 400);
      assertInvalidRequest(response.body as unknown);
    });
  }

  void it("rejects webhook patch requests with no mutable fields", async () => {
    const app = createApp();
    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({
        url: "https://example.test/hook",
        events: ["usage.recorded"],
      });
    const id = created.body.id as string;

    const response = await request(app).patch(`/api/v1/webhooks/${id}`).send({});

    assert.strictEqual(response.status, 400);
    assertInvalidRequest(response.body as unknown);
  });

  for (const [label, payload] of [
    ["non-http url", { url: "mailto:test@example.test" }],
    ["empty events", { events: [] }],
    ["non-string event", { events: ["usage.recorded", 4] }],
  ] as const) {
    void it(`rejects webhook patch with ${label}`, async () => {
      const app = createApp();
      const created = await request(app)
        .post("/api/v1/webhooks")
        .send({
          url: "https://example.test/hook",
          events: ["usage.recorded"],
        });
      const id = created.body.id as string;

      const response = await request(app).patch(`/api/v1/webhooks/${id}`).send(payload);

      assert.strictEqual(response.status, 400);
      assertInvalidRequest(response.body as unknown);
    });
  }

  void it("returns 404 when patching an unknown webhook", async () => {
    const app = createApp();

    const response = await request(app)
      .patch("/api/v1/webhooks/wh_missing")
      .send({ url: "https://example.test/hook" });

    assert.strictEqual(response.status, 404);
    assert.strictEqual(response.body.error, "not_found");
    assert.strictEqual(typeof response.body.requestId, "string");
  });
});
