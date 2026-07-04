import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { config, rateBuckets } from "./store/state.js";

const defaultConfig = {
  rateLimitPerWindow: 60,
  rateLimitWindowMs: 60_000,
  bulkMaxItems: 100,
  eventLogCap: 10_000,
};

const originalNodeEnv = process.env.NODE_ENV;

beforeEach(() => {
  rateBuckets.clear();
  Object.assign(config, defaultConfig);
  process.env.NODE_ENV = originalNodeEnv;
});

async function withLimiterEnabled<T>(fn: () => Promise<T>): Promise<T> {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousLog = console.log;
  process.env.NODE_ENV = "production";
  console.log = () => undefined;
  try {
    return await fn();
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    console.log = previousLog;
  }
}

function stringBodyField(body: unknown, field: string): string {
  assert.ok(body && typeof body === "object", "response body must be an object");
  const value = (body as Record<string, unknown>)[field];
  assert.strictEqual(typeof value, "string", `${field} must be a string`);
  return value as string;
}

void describe("live rate limit config", () => {
  void it("honours a lowered rateLimitPerWindow value immediately", async () => {
    const app = createApp();
    await request(app).patch("/api/v1/config").send({
      rateLimitPerWindow: 1,
      rateLimitWindowMs: 60_000,
    });

    await withLimiterEnabled(async () => {
      const first = await request(app).get("/api/v1/version");
      assert.strictEqual(first.status, 200);

      const limited = await request(app)
        .get("/api/v1/version")
        .set("X-Request-Id", "rate-limited-live-config");
      assert.strictEqual(limited.status, 429);
      assert.strictEqual(limited.body.error, "rate_limited");
      assert.strictEqual(limited.body.requestId, "rate-limited-live-config");
      assert.strictEqual(limited.headers["retry-after"], "60");
      assert.match(
        stringBodyField(limited.body, "message"),
        /more than 1 requests per 60s/
      );
    });
  });

  void it("uses the live rateLimitWindowMs when pruning buckets", async () => {
    const app = createApp();
    await request(app).patch("/api/v1/config").send({
      rateLimitPerWindow: 1,
      rateLimitWindowMs: 1,
    });

    await withLimiterEnabled(async () => {
      const first = await request(app).get("/api/v1/version");
      assert.strictEqual(first.status, 200);

      const bucketKey = Array.from(rateBuckets.keys())[0];
      assert.ok(bucketKey, "expected the first request to create a rate bucket");
      rateBuckets.set(
        bucketKey,
        Array.from({ length: 60 }, () => Date.now() - 2)
      );

      const second = await request(app).get("/api/v1/version");
      assert.strictEqual(second.status, 200);
    });
  });

  void it("computes Retry-After from the live rateLimitWindowMs value", async () => {
    const app = createApp();
    await request(app).patch("/api/v1/config").send({
      rateLimitPerWindow: 1,
      rateLimitWindowMs: 2_500,
    });

    await withLimiterEnabled(async () => {
      const first = await request(app).get("/api/v1/version");
      assert.strictEqual(first.status, 200);

      const limited = await request(app).get("/api/v1/version");
      assert.strictEqual(limited.status, 429);
      assert.strictEqual(limited.headers["retry-after"], "3");
      assert.match(
        stringBodyField(limited.body, "message"),
        /more than 1 requests per 2\.5s/
      );
    });
  });
});
