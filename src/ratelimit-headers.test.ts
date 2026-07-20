import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request, { type Response } from "supertest";
import { createApp } from "./index.js";
import {
  apiKeyStore,
  rateBuckets,
  RATE_LIMIT_PER_WINDOW,
  RATE_LIMIT_WINDOW_MS,
} from "./store/state.js";
import { hashApiKey } from "./auth/apiKeys.js";

let previousNodeEnv: string | undefined;
let previousConsoleLog: typeof console.log;

beforeEach(() => {
  previousNodeEnv = process.env.NODE_ENV;
  previousConsoleLog = console.log;
  process.env.NODE_ENV = "development";
  console.log = () => undefined;
  rateBuckets.clear();
  apiKeyStore.clear();
});

afterEach(() => {
  console.log = previousConsoleLog;
  if (previousNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = previousNodeEnv;
  }
  rateBuckets.clear();
  apiKeyStore.clear();
});

function numericHeader(res: Response, name: string): number {
  const value = res.header[name.toLowerCase()];
  assert.ok(typeof value === "string", `expected ${name} header`);
  const parsed = Number(value);
  assert.ok(Number.isInteger(parsed), `expected ${name} to be an integer`);
  return parsed;
}

/** Makes one request and returns the rate-limit key the middleware derived. */
async function discoverKey(app: ReturnType<typeof createApp>): Promise<string> {
  const res = await request(app).get("/api/v1/version");
  assert.strictEqual(res.status, 200);
  const key = Array.from(rateBuckets.keys())[0];
  assert.ok(typeof key === "string", "expected a rate bucket key after first request");
  return key;
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
    const key = await discoverKey(app);

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
    const key = await discoverKey(app);

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

  void it("emits correct RateLimit-Remaining across a full window of requests", async () => {
    const app = createApp();

    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i += 1) {
      const res = await request(app).get("/api/v1/version");
      assert.strictEqual(res.status, 200);
      assert.strictEqual(
        numericHeader(res, "RateLimit-Remaining"),
        RATE_LIMIT_PER_WINDOW - i - 1
      );
      assert.strictEqual(numericHeader(res, "RateLimit-Limit"), RATE_LIMIT_PER_WINDOW);
      assert.ok(numericHeader(res, "RateLimit-Reset") > 0);
    }

    const limited = await request(app).get("/api/v1/version");
    assert.strictEqual(limited.status, 429);
    assert.strictEqual(numericHeader(limited, "RateLimit-Remaining"), 0);
    assert.strictEqual(numericHeader(limited, "RateLimit-Limit"), RATE_LIMIT_PER_WINDOW);
    assert.strictEqual(limited.body.error, "rate_limited");
  });

  void it("reports RateLimit-Remaining as 0 and includes Retry-After on 429", async () => {
    const app = createApp();
    const key = await discoverKey(app);

    // Fill the bucket to exactly the limit
    rateBuckets.set(
      key,
      Array.from({ length: RATE_LIMIT_PER_WINDOW }, () => Date.now() - 10_000)
    );

    const limited = await request(app)
      .get("/api/v1/version")
      .set("X-Request-Id", "test-429");

    assert.strictEqual(limited.status, 429);
    assert.strictEqual(numericHeader(limited, "RateLimit-Remaining"), 0);
    assert.strictEqual(numericHeader(limited, "RateLimit-Limit"), RATE_LIMIT_PER_WINDOW);

    const reset = numericHeader(limited, "RateLimit-Reset");
    const retryAfter = numericHeader(limited, "Retry-After");
    assert.ok(retryAfter > 0, "Retry-After must be positive");
    assert.ok(retryAfter <= RATE_LIMIT_WINDOW_MS / 1000, "Retry-After must not exceed window");
    assert.strictEqual(retryAfter, reset, "RateLimit-Reset and Retry-After must match");
    assert.strictEqual(limited.body.requestId, "test-429");
  });

  void it("does not leak Retry-After header on successful responses", async () => {
    const app = createApp();

    const res = await request(app).get("/api/v1/version");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.header["retry-after"], undefined);
  });

  void it("includes all three RateLimit headers on every response including 429", async () => {
    const app = createApp();
    const key = await discoverKey(app);

    // Verify 200 responses carry all three headers
    const allowed = await request(app).get("/api/v1/version");
    assert.strictEqual(allowed.status, 200);
    assert.ok(typeof allowed.header["ratelimit-limit"] === "string");
    assert.ok(typeof allowed.header["ratelimit-remaining"] === "string");
    assert.ok(typeof allowed.header["ratelimit-reset"] === "string");

    // Fill the bucket so the next request is rate-limited
    rateBuckets.set(
      key,
      Array.from({ length: RATE_LIMIT_PER_WINDOW }, () => Date.now())
    );

    const limited = await request(app).get("/api/v1/version");
    assert.strictEqual(limited.status, 429);
    assert.ok(typeof limited.header["ratelimit-limit"] === "string");
    assert.ok(typeof limited.header["ratelimit-remaining"] === "string");
    assert.ok(typeof limited.header["ratelimit-reset"] === "string");
  });

  void it("ensures RateLimit-Reset is always at least 1 second", async () => {
    const app = createApp();
    const key = await discoverKey(app);

    // Fill the bucket with timestamps right at the very edge of the window
    const almostExpired = Date.now() - RATE_LIMIT_WINDOW_MS + 500;
    rateBuckets.set(
      key,
      Array.from({ length: RATE_LIMIT_PER_WINDOW }, () => almostExpired)
    );

    const limited = await request(app).get("/api/v1/version");
    assert.strictEqual(limited.status, 429);
    const reset = numericHeader(limited, "RateLimit-Reset");
    assert.ok(reset >= 1, `RateLimit-Reset was ${reset}, expected >= 1`);
  });

  void it("uses separate buckets for requests with different API keys", async () => {
    const rawKeyA = "apk_first_headers_test";
    const rawKeyB = "apk_second_headers_test";
    const hashedA = hashApiKey(rawKeyA);
    const hashedB = hashApiKey(rawKeyB);

    apiKeyStore.set(hashedA, { label: "first", createdAt: Date.now(), prefix: "first" });
    apiKeyStore.set(hashedB, { label: "second", createdAt: Date.now(), prefix: "second" });

    const app = createApp();

    // Key A hits the limit
    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i += 1) {
      const res = await request(app).get("/api/v1/version").set("X-API-Key", rawKeyA);
      assert.strictEqual(res.status, 200, `request ${i} with key A should be allowed`);
    }

    // Key B is still allowed — separate bucket
    const isolated = await request(app)
      .get("/api/v1/version")
      .set("X-API-Key", rawKeyB);
    assert.strictEqual(isolated.status, 200);
    assert.strictEqual(
      numericHeader(isolated, "RateLimit-Remaining"),
      RATE_LIMIT_PER_WINDOW - 1
    );

    // Key A is limited
    const limited = await request(app)
      .get("/api/v1/version")
      .set("X-API-Key", rawKeyA);
    assert.strictEqual(limited.status, 429);
    assert.strictEqual(numericHeader(limited, "RateLimit-Remaining"), 0);
  });

  void it("never reports negative RateLimit-Remaining after a limit breach", async () => {
    const app = createApp();

    // Saturate the bucket
    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i += 1) {
      await request(app).get("/api/v1/version");
    }

    // Multiple 429 responses should still report 0, not negative
    for (let i = 0; i < 3; i += 1) {
      const limited = await request(app).get("/api/v1/version");
      assert.strictEqual(limited.status, 429);
      const remaining = numericHeader(limited, "RateLimit-Remaining");
      assert.ok(remaining >= 0, `RateLimit-Remaining was ${remaining}, expected >= 0`);
    }
  });

  void it("caps Retry-After to the full window when all hits are at the oldest edge", async () => {
    const app = createApp();
    const key = await discoverKey(app);

    // Fill with requests near the start of the window, leaving enough
    // margin that Date.now() drift between setup and the request won't
    // accidentally expire them.
    const baseTime = Date.now() - RATE_LIMIT_WINDOW_MS + 2_000;
    rateBuckets.set(
      key,
      Array.from({ length: RATE_LIMIT_PER_WINDOW }, () => baseTime)
    );

    const limited = await request(app).get("/api/v1/version");
    assert.strictEqual(limited.status, 429);

    const retryAfter = numericHeader(limited, "Retry-After");
    // Should be close to the full window (in seconds) but not more
    assert.ok(
      retryAfter <= RATE_LIMIT_WINDOW_MS / 1000,
      `Retry-After ${retryAfter} exceeds window ${RATE_LIMIT_WINDOW_MS / 1000}s`
    );
  });

  void it("returns the same bucket key for repeated requests from the same IP", async () => {
    const app = createApp();

    await request(app).get("/api/v1/version");
    const firstKeys = Array.from(rateBuckets.keys());
    assert.strictEqual(firstKeys.length, 1);

    await request(app).get("/api/v1/version");
    const secondKeys = Array.from(rateBuckets.keys());
    assert.strictEqual(secondKeys.length, 1);
    assert.strictEqual(secondKeys[0], firstKeys[0]);
  });
});
