import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { config } from "./store/state.js";

const defaultConfig = {
  rateLimitPerWindow: 60,
  rateLimitWindowMs: 60_000,
  bulkMaxItems: 100,
  eventLogCap: 10_000,
  usageStoreMaxKeys: 100_000,
  servicesStoreMaxKeys: 10_000,
  webhookStoreMaxKeys: 10_000,
  apiKeyStoreMaxKeys: 10_000,
};

beforeEach(() => {
  Object.assign(config, defaultConfig);
});

void describe("config list pagination", () => {
  void it("pages through config entries with a stable cursor", async () => {
    const app = createApp();

    const firstPage = await request(app).get("/api/v1/config").query({ limit: 4 });
    assert.strictEqual(firstPage.status, 200);
    assert.strictEqual(firstPage.body.total, 8);
    assert.deepStrictEqual(
      firstPage.body.items.map((entry: { key: string }) => entry.key),
      ["apiKeyStoreMaxKeys", "bulkMaxItems", "eventLogCap", "rateLimitPerWindow"]
    );
    assert.strictEqual(typeof firstPage.body.nextCursor, "string");

    const secondPage = await request(app)
      .get("/api/v1/config")
      .query({ limit: 4, cursor: firstPage.body.nextCursor });
    assert.strictEqual(secondPage.status, 200);
    assert.deepStrictEqual(
      secondPage.body.items.map((entry: { key: string }) => entry.key),
      [
        "rateLimitWindowMs",
        "servicesStoreMaxKeys",
        "usageStoreMaxKeys",
        "webhookStoreMaxKeys",
      ]
    );
    assert.strictEqual(secondPage.body.nextCursor, null);
  });

  void it("clamps over-limit page sizes to the configured maximum", async () => {
    const app = createApp();

    const res = await request(app).get("/api/v1/config").query({ limit: 999 });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.items.length, 4);
    assert.strictEqual(res.body.nextCursor, "cmF0ZUxpbWl0UGVyV2luZG93");
  });

  void it("returns an empty page for an empty config set", async () => {
    const savedConfig = { ...config };
    for (const key of Object.keys(config)) {
      Reflect.deleteProperty(config, key);
    }

    try {
      const app = createApp();
      const res = await request(app).get("/api/v1/config");

      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(res.body, {
        config: {},
        items: [],
        total: 0,
        nextCursor: null,
      });
    } finally {
      Object.assign(config, savedConfig);
    }
  });

  void it("rejects malformed and expired cursors", async () => {
    const app = createApp();

    const malformed = await request(app).get("/api/v1/config").query({ cursor: "!!" });
    assert.strictEqual(malformed.status, 400);
    assert.strictEqual(malformed.body.error, "invalid_request");
    assert.strictEqual(malformed.body.message, "cursor is malformed");

    const expiredCursor = Buffer.from("missing-key").toString("base64url");
    const expired = await request(app).get("/api/v1/config").query({ cursor: expiredCursor });
    assert.strictEqual(expired.status, 400);
    assert.strictEqual(expired.body.error, "invalid_request");
    assert.strictEqual(expired.body.message, "cursor is invalid or expired");
  });
});
