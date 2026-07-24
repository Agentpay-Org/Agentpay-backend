import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { eventLog, recordEvent } from "./events.js";
import { createApp } from "./index.js";
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

function seedEvents(): void {
  for (const label of ["a", "b", "c", "d", "e"]) {
    recordEvent(label === "c" ? "billing.quoted" : "usage.recorded", { label });
  }
}

void describe("GET /api/v1/events/summary", () => {
  void it("returns zero counts and zero total for an empty log", async () => {
    const app = createApp();

    const res = await request(app).get("/api/v1/events/summary");

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body, { counts: {}, total: 0 });
  });

  void it("returns per-type counts and a total across mixed event types", async () => {
    seedEvents();
    const app = createApp();

    const res = await request(app).get("/api/v1/events/summary");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 5);
    assert.deepStrictEqual(res.body.counts, {
      "usage.recorded": 4,
      "billing.quoted": 1,
    });
  });
});

void describe("GET /api/v1/events success and empty-result paths", () => {
  void it("returns 200 with the expected shape for a plain, unfiltered request", async () => {
    seedEvents();
    const app = createApp();

    const res = await request(app).get("/api/v1/events");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 5);
    assert.strictEqual(res.body.items.length, 5);
    assert.ok(
      res.body.nextCursor === null || typeof res.body.nextCursor === "string"
    );
  });

  void it("returns an empty result set (not a 404) when a type filter matches nothing", async () => {
    seedEvents();
    const app = createApp();

    const res = await request(app).get(
      "/api/v1/events?type=does.not.exist"
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 0);
    assert.deepStrictEqual(res.body.items, []);
    assert.strictEqual(res.body.nextCursor, null);
  });

  void it("returns an empty result set when since excludes every event", async () => {
    seedEvents();
    const app = createApp();
    const future = Date.now() + 60_000;

    const res = await request(app).get(`/api/v1/events?since=${future}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 0);
    assert.deepStrictEqual(res.body.items, []);
    assert.strictEqual(res.body.nextCursor, null);
  });
});

void describe("GET /api/v1/events limit/since bounds handling", () => {
  void it("clamps a limit above the configured cap down to the cap", async () => {
    seedEvents();
    const app = createApp();

    const res = await request(app).get(
      `/api/v1/events?limit=${config.eventLogCap + 1000}`
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.items.length, 5);
  });

  void it("clamps a non-positive limit up to the minimum of 1", async () => {
    seedEvents();
    const app = createApp();

    const res = await request(app).get("/api/v1/events?limit=0");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.items.length, 1);
  });

  void it("falls back to the default limit for a non-numeric limit value", async () => {
    seedEvents();
    const app = createApp();

    const res = await request(app).get("/api/v1/events?limit=not-a-number");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.items.length, 5);
  });

  void it("falls back to since=0 for a non-numeric since value, including everything", async () => {
    seedEvents();
    const app = createApp();

    const res = await request(app).get("/api/v1/events?since=not-a-number");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 5);
  });

  void it("clamps a negative since up to the minimum of 0", async () => {
    seedEvents();
    const app = createApp();

    const res = await request(app).get("/api/v1/events?since=-100");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 5);
  });
});

void describe("GET /api/v1/events conditional requests (ETag / If-None-Match)", () => {
  void it("returns an ETag header alongside a 200 on the first request", async () => {
    seedEvents();
    const app = createApp();

    const res = await request(app).get("/api/v1/events");

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.etag, "expected an ETag header on the response");
  });

  void it("returns 304 with an empty body when If-None-Match matches the current ETag", async () => {
    seedEvents();
    const app = createApp();

    const first = await request(app).get("/api/v1/events");
    const repeat = await request(app)
      .get("/api/v1/events")
      .set("If-None-Match", first.headers.etag);

    assert.strictEqual(repeat.status, 304);
    assert.strictEqual(repeat.text, "");
  });

  void it("returns 200 with fresh data when If-None-Match does not match", async () => {
    seedEvents();
    const app = createApp();

    const res = await request(app)
      .get("/api/v1/events")
      .set("If-None-Match", 'W/"stale-etag-value"');

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.total, 5);
  });

  void it("produces a different ETag for a genuinely different query scope", async () => {
    seedEvents();
    const app = createApp();

    const unfiltered = await request(app).get("/api/v1/events");
    const filtered = await request(app).get(
      "/api/v1/events?type=billing.quoted"
    );

    assert.notStrictEqual(unfiltered.headers.etag, filtered.headers.etag);
  });
});