import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { eventLog, recordEvent } from "./events.js";
import { config } from "./store/state.js";

const defaultConfig = {
  rateLimitPerWindow: 60,
  rateLimitWindowMs: 60_000,
  bulkMaxItems: 100,
  eventLogCap: 10_000,
};

beforeEach(() => {
  eventLog.length = 0;
  Object.assign(config, defaultConfig);
});

void describe("config patch route", () => {
  void it("accepts eventLogCap updates and trims the current event log", async () => {
    const app = createApp();
    recordEvent("event.one", {});
    recordEvent("event.two", {});
    recordEvent("event.three", {});

    const res = await request(app).patch("/api/v1/config").send({ eventLogCap: 2 });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.config.eventLogCap, 2);
    assert.strictEqual(config.eventLogCap, 2);
    assert.strictEqual(eventLog.length, 2);
    assert.deepStrictEqual(
      eventLog.map((event) => event.type),
      ["event.two", "event.three"]
    );
  });

  void it("honors the updated eventLogCap when recording later events", async () => {
    const app = createApp();

    await request(app).patch("/api/v1/config").send({ eventLogCap: 2 });
    recordEvent("event.one", {});
    recordEvent("event.two", {});
    recordEvent("event.three", {});

    const events = await request(app).get("/api/v1/events").query({ limit: 10 });

    assert.strictEqual(events.status, 200);
    assert.deepStrictEqual(
      events.body.items.map((event: { type: string }) => event.type),
      ["event.two", "event.three"]
    );
  });

  void it("rejects unknown config keys and leaves valid keys unchanged", async () => {
    const app = createApp();

    const res = await request(app)
      .patch("/api/v1/config")
      .send({ rateLimitPerWindow: 75, rateLimitPerWindw: 99 });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.deepStrictEqual(res.body.unknownKeys, ["rateLimitPerWindw"]);
    assert.strictEqual(config.rateLimitPerWindow, 60);
  });

  void it("rejects non-integer eventLogCap values", async () => {
    const app = createApp();

    const res = await request(app).patch("/api/v1/config").send({ eventLogCap: 2.5 });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.strictEqual(res.body.message, "eventLogCap must be a positive integer");
    assert.strictEqual(config.eventLogCap, 10_000);
  });

  void it("rejects eventLogCap values above the memory-safety ceiling", async () => {
    const app = createApp();

    const res = await request(app)
      .patch("/api/v1/config")
      .send({ eventLogCap: 100_001 });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.strictEqual(
      res.body.message,
      "eventLogCap must be less than or equal to 100000"
    );
    assert.strictEqual(config.eventLogCap, 10_000);
  });

  void it("keeps the existing config success shape for valid multi-key updates", async () => {
    const app = createApp();

    const res = await request(app).patch("/api/v1/config").send({
      rateLimitPerWindow: 75,
      rateLimitWindowMs: 30_000,
      bulkMaxItems: 50,
      eventLogCap: 500,
    });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.config, {
      rateLimitPerWindow: 75,
      rateLimitWindowMs: 30_000,
      bulkMaxItems: 50,
      eventLogCap: 500,
    });
  });
});
