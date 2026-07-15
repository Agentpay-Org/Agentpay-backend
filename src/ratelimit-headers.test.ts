import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request, { type Response } from "supertest";
import { createApp } from "./index.js";
import {
  rateBuckets,
  RATE_LIMIT_PER_WINDOW,
  RATE_LIMIT_WINDOW_MS,
} from "./store/state.js";

let previousNodeEnv: string | undefined;
let previousConsoleLog: typeof console.log;

beforeEach(() => {
  previousNodeEnv = process.env.NODE_ENV;
  previousConsoleLog = console.log;
  process.env.NODE_ENV = "development";
  console.log = () => undefined;
  rateBuckets.clear();
});

afterEach(() => {
  console.log = previousConsoleLog;
  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
  rateBuckets.clear();
});

function numericHeader(res: Response, name: string): number {
  const value = res.header[name.toLowerCase()];
  assert.ok(typeof value === "string", `expected ${name} header`);
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed), `expected ${name} to be an integer`);
  return parsed;
}

void describe("rate limit headers", () => {
  void it("emits RateLimit headers on allowed requests", async () => {
    const app = createApp();

    const first = await request(app).get("/api/v1/version");
    const second = await request(app).get("/api/v1/version");

    assert.strictEqual(first.status, 200);
    assert.strictEqual(numericHeader(first, "RateLimit-Limit"), RATE_LIMIT_PER_WINDOW);
    assert.strictEqual(
      numericHeader(first, "RateLimit-Remaining"),
      RATE_LIMIT_PER_WINDOW - 1
    );
    assert.ok(numericHeader(first, "RateLimit-Reset") > 0);

    assert.strictEqual(second.status, 200);
    assert.strictEqual(
      numericHeader(second, "RateLimit-Remaining"),
      RATE_LIMIT_PER_WINDOW - 2
    );
  });

  void it("computes Retry-After from the active window on limited requests", async () => {
    const app = createApp();
    const first = await request(app).get("/api/v1/version");
    assert.strictEqual(first.status, 200);

    const key = Array.from(rateBuckets.keys())[0];
    assert.ok(typeof key === "string");
    const oldestInWindow = Date.now() - RATE_LIMIT_WINDOW_MS + 30_000;
    rateBuckets.set(
      key,
      Array.from({ length: RATE_LIMIT_PER_WINDOW }, () => oldestInWindow)
    );

    const limited = await request(app)
      .get("/api/v1/version")
      .set("X-Request-Id", "rate-limit-test");

    assert.strictEqual(limited.status, 429);
    assert.strictEqual(limited.body.error, "rate_limited");
    assert.strictEqual(limited.body.requestId, "rate-limit-test");
    assert.strictEqual(
      numericHeader(limited, "RateLimit-Limit"),
      RATE_LIMIT_PER_WINDOW
    );
    assert.strictEqual(numericHeader(limited, "RateLimit-Remaining"), 0);

    const reset = numericHeader(limited, "RateLimit-Reset");
    const retryAfter = numericHeader(limited, "Retry-After");
    assert.strictEqual(retryAfter, reset);
    assert.ok(reset > 0);
    assert.ok(reset < RATE_LIMIT_WINDOW_MS / 1000);
  });

  void it("prunes expired requests before reporting remaining capacity", async () => {
    const app = createApp();
    const first = await request(app).get("/api/v1/version");
    assert.strictEqual(first.status, 200);

    const key = Array.from(rateBuckets.keys())[0];
    assert.ok(typeof key === "string");
    const now = Date.now();
    rateBuckets.set(key, [
      now - RATE_LIMIT_WINDOW_MS - 1_000,
      now - RATE_LIMIT_WINDOW_MS - 500,
      now - 10_000,
    ]);

    const allowed = await request(app).get("/api/v1/version");

    assert.strictEqual(allowed.status, 200);
    assert.strictEqual(
      numericHeader(allowed, "RateLimit-Remaining"),
      RATE_LIMIT_PER_WINDOW - 2
    );
    assert.ok(numericHeader(allowed, "RateLimit-Reset") > 0);
    assert.strictEqual(allowed.header["retry-after"], undefined);
  });
});
