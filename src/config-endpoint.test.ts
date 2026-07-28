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
};

beforeEach(() => {
  Object.assign(config, defaultConfig);
});

void describe("config endpoint family", () => {
  void it("returns the current config snapshot on GET", async () => {
    const app = createApp();

    const res = await request(app).get("/api/v1/config");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.config, defaultConfig);
  });

  void it("is idempotent when the same PATCH body is replayed", async () => {
    const app = createApp();
    const body = { rateLimitPerWindow: 75, eventLogCap: 2_000 };

    const first = await request(app).patch("/api/v1/config").send(body);
    const second = await request(app).patch("/api/v1/config").send(body);

    assert.strictEqual(first.status, 200);
    assert.strictEqual(second.status, 200);
    assert.deepStrictEqual(first.body.config, second.body.config);
    assert.deepStrictEqual(second.body.config, {
      rateLimitPerWindow: 75,
      rateLimitWindowMs: 60_000,
      bulkMaxItems: 100,
      eventLogCap: 2_000,
    });
  });

  void it("rejects malformed and unknown config writes with structured errors", async () => {
    const app = createApp();

    const malformed = await request(app).patch("/api/v1/config").send([]);
    assert.strictEqual(malformed.status, 400);
    assert.strictEqual(malformed.body.error, "invalid_request");
    assert.strictEqual(malformed.body.message, "body must be a JSON object");

    const unknownField = await request(app)
      .patch("/api/v1/config")
      .send({ rateLimitPerWindow: 75, extraField: 1 });
    assert.strictEqual(unknownField.status, 400);
    assert.strictEqual(unknownField.body.error, "invalid_request");
    assert.deepStrictEqual(unknownField.body.unknownKeys, ["extraField"]);
  });
});
