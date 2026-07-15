import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { webhookStore } from "./store/state.js";

const app = createApp();

beforeEach(() => {
  webhookStore.clear();
});

void describe("single webhook fetch endpoint", () => {
  void it("returns one webhook with the same shape as the list endpoint", async () => {
    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({
        url: "https://example.test/usage",
        events: ["usage.recorded"],
      });
    assert.strictEqual(created.status, 201);

    const id: unknown = created.body.id;
    assert.ok(typeof id === "string");

    const fetched = await request(app).get(`/api/v1/webhooks/${id}`);
    const listed = await request(app).get("/api/v1/webhooks");

    assert.strictEqual(fetched.status, 200);
    assert.deepStrictEqual(fetched.body, listed.body.items[0]);
  });

  void it("returns the updated webhook after a patch", async () => {
    const created = await request(app)
      .post("/api/v1/webhooks")
      .send({
        url: "https://example.test/original",
        events: ["usage.recorded"],
      });
    assert.strictEqual(created.status, 201);

    const id: unknown = created.body.id;
    assert.ok(typeof id === "string");

    const patched = await request(app)
      .patch(`/api/v1/webhooks/${id}`)
      .send({
        url: "https://example.test/updated",
        events: ["usage.settled"],
      });
    assert.strictEqual(patched.status, 200);

    const fetched = await request(app).get(`/api/v1/webhooks/${id}`);

    assert.strictEqual(fetched.status, 200);
    assert.strictEqual(fetched.body.id, id);
    assert.strictEqual(fetched.body.url, "https://example.test/updated");
    assert.deepStrictEqual(fetched.body.events, ["usage.settled"]);
  });

  void it("returns the webhook-specific 404 for missing or deleted ids", async () => {
    const missing = await request(app)
      .get("/api/v1/webhooks/wh_missing")
      .set("X-Request-Id", "missing-webhook");

    assert.strictEqual(missing.status, 404);
    assert.strictEqual(missing.body.error, "not_found");
    assert.strictEqual(missing.body.message, "webhook wh_missing not registered");
    assert.strictEqual(missing.body.requestId, "missing-webhook");

    webhookStore.set("wh_existing", {
      url: "https://example.test/hook",
      events: ["usage.recorded"],
      createdAt: 1,
    });

    const deleted = await request(app).delete("/api/v1/webhooks/wh_existing");
    assert.strictEqual(deleted.status, 204);

    const afterDelete = await request(app)
      .get("/api/v1/webhooks/wh_existing")
      .set("X-Request-Id", "deleted-webhook");

    assert.strictEqual(afterDelete.status, 404);
    assert.strictEqual(afterDelete.body.error, "not_found");
    assert.strictEqual(afterDelete.body.message, "webhook wh_existing not registered");
    assert.strictEqual(afterDelete.body.requestId, "deleted-webhook");
  });

  void it("documents the single-webhook read in the OpenAPI metadata", async () => {
    const openapi = await request(app).get("/api/v1/openapi.json");

    assert.strictEqual(openapi.status, 200);
    assert.strictEqual(
      openapi.body.paths["/api/v1/webhooks/{id}"].get.summary,
      "Fetch one webhook"
    );
  });
});
