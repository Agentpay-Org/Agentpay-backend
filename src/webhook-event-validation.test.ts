import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { webhookStore } from "./store/state.js";

const app = createApp();

beforeEach(() => {
  webhookStore.clear();
});

void describe("webhook event taxonomy validation", () => {
  void it("accepts known event names and the wildcard on registration", async () => {
    const known = await request(app)
      .post("/api/v1/webhooks")
      .send({
        url: "https://example.test/usage",
        events: ["usage.recorded", "usage.settled", "webhook.test"],
      });

    assert.strictEqual(known.status, 201);
    assert.deepStrictEqual(known.body.events, [
      "usage.recorded",
      "usage.settled",
      "webhook.test",
    ]);

    const wildcard = await request(app)
      .post("/api/v1/webhooks")
      .send({
        url: "https://example.test/all",
        events: ["*"],
      });

    assert.strictEqual(wildcard.status, 201);
    assert.deepStrictEqual(wildcard.body.events, ["*"]);
  });

  void it("rejects unknown event names on registration without storing a webhook", async () => {
    const res = await request(app)
      .post("/api/v1/webhooks")
      .send({
        url: "https://example.test/bad",
        events: ["usage.recorded", "usage.recordd"],
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    const message: unknown = res.body.message;
    assert.ok(typeof message === "string");
    assert.match(message, /usage\.recordd/);
    assert.strictEqual(webhookStore.size, 0);
  });

  void it("rejects unknown event names on patch without changing existing events", async () => {
    webhookStore.set("wh_existing", {
      url: "https://example.test/hook",
      events: ["usage.recorded"],
      createdAt: 1,
    });

    const res = await request(app)
      .patch("/api/v1/webhooks/wh_existing")
      .send({
        events: ["usage.settled", "completely.made.up"],
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    const message: unknown = res.body.message;
    assert.ok(typeof message === "string");
    assert.match(message, /completely\.made\.up/);
    assert.deepStrictEqual(webhookStore.get("wh_existing")?.events, ["usage.recorded"]);
  });

  void it("keeps the non-empty string-array validation before taxonomy checks", async () => {
    const res = await request(app)
      .post("/api/v1/webhooks")
      .send({
        url: "https://example.test/bad",
        events: ["usage.recorded", 7],
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.strictEqual(res.body.message, "events must be a non-empty array of strings");
  });
});
