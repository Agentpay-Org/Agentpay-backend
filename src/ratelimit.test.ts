import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request, { type Response } from "supertest";
import { app } from "./index.js";

const DEFAULT_RATE_LIMIT_PER_WINDOW = 60;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

type ErrorEnvelope = {
  error?: unknown;
  message?: unknown;
  requestId?: unknown;
};

const originalDateNow = Date.now;
const originalConsoleLog = console.log;
const originalNodeEnv = process.env.NODE_ENV;

function restoreNodeEnv() {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
    return;
  }
  process.env.NODE_ENV = originalNodeEnv;
}

async function patchRateConfig(values: {
  rateLimitPerWindow?: number;
  rateLimitWindowMs?: number;
}) {
  const res = await request(app).patch("/api/v1/config").send(values);
  assert.strictEqual(res.status, 200);
  return res;
}

async function restoreRateConfig() {
  await patchRateConfig({
    rateLimitPerWindow: DEFAULT_RATE_LIMIT_PER_WINDOW,
    rateLimitWindowMs: DEFAULT_RATE_LIMIT_WINDOW_MS,
  });
}

function assertRateLimited(res: Response, requestId: string, retryAfter: string) {
  assert.strictEqual(res.status, 429);
  const body = res.body as ErrorEnvelope;
  assert.strictEqual(body.error, "rate_limited");
  assert.strictEqual(typeof body.message, "string");
  assert.ok((body.message as string).length > 0);
  assert.strictEqual(body.requestId, requestId);
  assert.strictEqual(res.headers["x-request-id"], requestId);
  assert.strictEqual(res.headers["retry-after"], retryAfter);
}

async function getHealth(requestId: string) {
  return request(app).get("/health").set("X-Request-Id", requestId);
}

beforeEach(async () => {
  Date.now = originalDateNow;
  console.log = originalConsoleLog;
  restoreNodeEnv();
  await request(app).post("/api/v1/admin/unpause");
  await restoreRateConfig();
});

afterEach(async () => {
  Date.now = originalDateNow;
  console.log = originalConsoleLog;
  restoreNodeEnv();
  await restoreRateConfig();
});

void describe("Live rate limit config", () => {
  void it("exposes default values and rejects a zero-length window", async () => {
    const config = await request(app).get("/api/v1/config");
    assert.strictEqual(config.status, 200);
    assert.strictEqual(
      config.body.config.rateLimitPerWindow,
      DEFAULT_RATE_LIMIT_PER_WINDOW
    );
    assert.strictEqual(
      config.body.config.rateLimitWindowMs,
      DEFAULT_RATE_LIMIT_WINDOW_MS
    );

    const bad = await request(app)
      .patch("/api/v1/config")
      .send({ rateLimitWindowMs: 0 });
    assert.strictEqual(bad.status, 400);
    assert.strictEqual(bad.body.error, "invalid_request");
    assert.strictEqual(typeof bad.body.requestId, "string");
  });

  void it("honours lowered and raised live thresholds within the current window", async () => {
    process.env.NODE_ENV = "production";
    console.log = () => undefined;

    await patchRateConfig({ rateLimitPerWindow: 4, rateLimitWindowMs: 2_000 });

    assert.strictEqual((await getHealth("rate-live-1")).status, 200);
    assert.strictEqual((await getHealth("rate-live-2")).status, 200);

    await patchRateConfig({ rateLimitPerWindow: 2 });
    const lowered = await getHealth("rate-live-lowered");
    assertRateLimited(lowered, "rate-live-lowered", "2");
    assert.match(lowered.body.message as string, /more than 2 requests per 2s/);

    await patchRateConfig({ rateLimitPerWindow: 4 });
    assert.strictEqual((await getHealth("rate-live-3")).status, 200);
    assert.strictEqual((await getHealth("rate-live-4")).status, 200);

    const raisedLimit = await getHealth("rate-live-raised-limit");
    assertRateLimited(raisedLimit, "rate-live-raised-limit", "2");
    assert.match(raisedLimit.body.message as string, /more than 4 requests per 2s/);
  });

  void it("prunes buckets using the live window length", async () => {
    process.env.NODE_ENV = "production";
    console.log = () => undefined;

    let now = originalDateNow() + 10_000_000;
    Date.now = () => now;

    await patchRateConfig({ rateLimitPerWindow: 1, rateLimitWindowMs: 1_000 });

    assert.strictEqual((await getHealth("rate-window-1")).status, 200);
    const limited = await getHealth("rate-window-limited");
    assertRateLimited(limited, "rate-window-limited", "1");

    now += 1_001;

    assert.strictEqual((await getHealth("rate-window-after-prune")).status, 200);
  });
});
