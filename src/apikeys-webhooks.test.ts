import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request, { type Response } from "supertest";
import { app } from "./index.js";

let seq = 0;
const unique = (label: string) => `aw-${Date.now()}-${++seq}-${label}`;

type ErrorEnvelope = {
  error?: unknown;
  message?: unknown;
  requestId?: unknown;
};

type ApiKeyListItem = {
  prefix?: unknown;
  key?: unknown;
  label?: unknown;
  createdAt?: unknown;
};

type WebhookListItem = {
  id?: unknown;
  url?: unknown;
  events?: unknown;
  createdAt?: unknown;
};

function assertErrorEnvelope(
  res: Response,
  expected: { status: number; error: string }
) {
  assert.strictEqual(res.status, expected.status);
  const body = res.body as ErrorEnvelope;
  assert.strictEqual(body.error, expected.error);
  assert.strictEqual(typeof body.message, "string");
  assert.ok((body.message as string).length > 0);
  assert.strictEqual(typeof body.requestId, "string");
  assert.ok((body.requestId as string).length > 0);
  assert.strictEqual(res.headers["x-request-id"], body.requestId);
}

async function createApiKey(label = unique("key")) {
  const res = await request(app).post("/api/v1/api-keys").send({ label });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(typeof res.body.key, "string");
  assert.ok((res.body.key as string).startsWith("apk_"));
  assert.strictEqual(res.body.label, label);
  return { key: res.body.key as string, label };
}

async function createWebhook() {
  const url = `https://hooks.example.test/${unique("hook")}`;
  const events = ["usage.recorded", "usage.settled"];
  const res = await request(app).post("/api/v1/webhooks").send({ url, events });
  assert.strictEqual(res.status, 201);
  assert.match(res.body.id as string, /^wh_[0-9a-f]{16}$/);
  assert.strictEqual(res.body.url, url);
  assert.deepStrictEqual(res.body.events, events);
  return { id: res.body.id as string, url, events };
}

beforeEach(async () => {
  await request(app).post("/api/v1/admin/unpause");
});

void describe("API key lifecycle", () => {
  void it("creates, lists, and revokes keys by prefix without listing the secret", async () => {
    const { key, label } = await createApiKey();
    const prefix = key.slice(0, 8);

    const list = await request(app).get("/api/v1/api-keys");
    assert.strictEqual(list.status, 200);
    assert.ok(!list.text.includes(key), "list response leaked full api key");
    const items = list.body.items as ApiKeyListItem[];
    const found = items.find((item) => item.prefix === prefix);
    assert.ok(found, "created key prefix missing from list");
    assert.strictEqual(found.key, undefined);
    assert.strictEqual(found.label, label);
    assert.strictEqual(typeof found.createdAt, "number");

    const deleted = await request(app).delete(`/api/v1/api-keys/${prefix}`);
    assert.strictEqual(deleted.status, 204);

    const afterDelete = await request(app).get("/api/v1/api-keys");
    assert.strictEqual(afterDelete.status, 200);
    assert.ok(
      !(afterDelete.body.items as ApiKeyListItem[]).some(
        (item) => item.prefix === prefix
      )
    );

    const missing = await request(app).delete(`/api/v1/api-keys/${prefix}`);
    assertErrorEnvelope(missing, { status: 404, error: "not_found" });
  });

  for (const [label, body] of [
    ["missing label", {}],
    ["empty label", { label: "" }],
    ["label longer than 64 chars", { label: "x".repeat(65) }],
  ] as const) {
    void it(`rejects api-key create with ${label}`, async () => {
      const res = await request(app).post("/api/v1/api-keys").send(body);
      assertErrorEnvelope(res, { status: 400, error: "invalid_request" });
    });
  }
});

void describe("Webhook CRUD", () => {
  void it("registers, lists, patches, tests, and deletes webhooks", async () => {
    const hook = await createWebhook();

    const list = await request(app).get("/api/v1/webhooks");
    assert.strictEqual(list.status, 200);
    const found = (list.body.items as WebhookListItem[]).find(
      (item) => item.id === hook.id
    );
    assert.ok(found, "created webhook missing from list");
    assert.strictEqual(found.url, hook.url);
    assert.deepStrictEqual(found.events, hook.events);
    assert.strictEqual(typeof found.createdAt, "number");

    const nextUrl = `https://hooks.example.test/${unique("updated")}`;
    const patchedUrl = await request(app)
      .patch(`/api/v1/webhooks/${hook.id}`)
      .send({ url: nextUrl });
    assert.strictEqual(patchedUrl.status, 200);
    assert.strictEqual(patchedUrl.body.url, nextUrl);
    assert.deepStrictEqual(patchedUrl.body.events, hook.events);

    const nextEvents = ["usage.recorded"];
    const patchedEvents = await request(app)
      .patch(`/api/v1/webhooks/${hook.id}`)
      .send({ events: nextEvents });
    assert.strictEqual(patchedEvents.status, 200);
    assert.strictEqual(patchedEvents.body.url, nextUrl);
    assert.deepStrictEqual(patchedEvents.body.events, nextEvents);

    const delivery = await request(app).post(`/api/v1/webhooks/${hook.id}/test`);
    assert.strictEqual(delivery.status, 200);
    assert.strictEqual(delivery.body.id, hook.id);
    assert.strictEqual(delivery.body.simulated, true);
    assert.strictEqual(typeof delivery.body.deliveredAt, "number");

    const deleted = await request(app).delete(`/api/v1/webhooks/${hook.id}`);
    assert.strictEqual(deleted.status, 204);

    const missingDelete = await request(app).delete(`/api/v1/webhooks/${hook.id}`);
    assertErrorEnvelope(missingDelete, { status: 404, error: "not_found" });

    const missingTest = await request(app).post(`/api/v1/webhooks/${hook.id}/test`);
    assertErrorEnvelope(missingTest, { status: 404, error: "not_found" });
  });

  for (const [label, body] of [
    ["missing url", { events: ["usage.recorded"] }],
    ["non-http url", { url: "ftp://example.test/hook", events: ["usage.recorded"] }],
    [
      "url longer than 2048 chars",
      { url: `https://example.test/${"x".repeat(2048)}`, events: ["usage.recorded"] },
    ],
    ["empty events array", { url: "https://example.test/hook", events: [] }],
    [
      "non-string event",
      { url: "https://example.test/hook", events: ["usage.recorded", 7] },
    ],
  ] as const) {
    void it(`rejects webhook create with ${label}`, async () => {
      const res = await request(app).post("/api/v1/webhooks").send(body);
      assertErrorEnvelope(res, { status: 400, error: "invalid_request" });
    });
  }

  for (const [label, body] of [
    ["neither url nor events", {}],
    ["non-http url", { url: "mailto:ops@example.test" }],
    ["empty events array", { events: [] }],
  ] as const) {
    void it(`rejects webhook patch with ${label}`, async () => {
      const hook = await createWebhook();
      const res = await request(app).patch(`/api/v1/webhooks/${hook.id}`).send(body);
      assertErrorEnvelope(res, { status: 400, error: "invalid_request" });
    });
  }

  void it("returns 404 when patching an unknown webhook", async () => {
    const res = await request(app)
      .patch(`/api/v1/webhooks/${unique("missing")}`)
      .send({ url: "https://example.test/hook" });
    assertErrorEnvelope(res, { status: 404, error: "not_found" });
  });
});
