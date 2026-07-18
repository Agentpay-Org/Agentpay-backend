import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { apiKeyStore, RATE_LIMIT_PER_WINDOW, rateBuckets } from "./store/state.js";

const originalNodeEnv = process.env.NODE_ENV;
const originalTrustProxy = process.env.TRUST_PROXY;
const originalConsoleLog = console.log;

function restoreEnv(): void {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }
  if (originalTrustProxy === undefined) {
    delete process.env.TRUST_PROXY;
  } else {
    process.env.TRUST_PROXY = originalTrustProxy;
  }
}

void describe("rate-limit key derivation", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "production";
    delete process.env.TRUST_PROXY;
    apiKeyStore.clear();
    rateBuckets.clear();
    console.log = () => undefined;
  });

  afterEach(() => {
    restoreEnv();
    apiKeyStore.clear();
    rateBuckets.clear();
    console.log = originalConsoleLog;
  });

  void it("does not let spoofed X-Forwarded-For values bypass the limiter when trust proxy is off", async () => {
    const app = createApp();

    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i += 1) {
      const res = await request(app)
        .get("/api/v1/version")
        .set("X-Forwarded-For", `198.51.100.${i}`);
      assert.strictEqual(res.status, 200);
    }

    const limited = await request(app)
      .get("/api/v1/version")
      .set("X-Forwarded-For", "198.51.100.250");

    assert.strictEqual(limited.status, 429);
    assert.strictEqual(limited.body.error, "rate_limited");
    assert.strictEqual(limited.headers["retry-after"], "60");
  });

  void it("honours the configured trusted proxy hop count for the client IP", async () => {
    process.env.TRUST_PROXY = "1";
    const app = createApp();

    for (let i = 0; i < RATE_LIMIT_PER_WINDOW + 1; i += 1) {
      const res = await request(app)
        .get("/api/v1/version")
        .set("X-Forwarded-For", `203.0.113.${i}`);
      assert.strictEqual(res.status, 200);
    }
  });

  void it("keys authenticated callers by API key before falling back to IP", async () => {
    const app = createApp();
    const firstKey = "apk_first_tenant";
    const secondKey = "apk_second_tenant";
    apiKeyStore.set(firstKey, { label: "first", createdAt: Date.now(), prefix: "first" });
    apiKeyStore.set(secondKey, { label: "second", createdAt: Date.now(), prefix: "second" });

    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i += 1) {
      const res = await request(app).get("/api/v1/version").set("X-API-Key", firstKey);
      assert.strictEqual(res.status, 200);
    }

    const isolated = await request(app)
      .get("/api/v1/version")
      .set("X-API-Key", secondKey);
    assert.strictEqual(isolated.status, 200);

    const limited = await request(app)
      .get("/api/v1/version")
      .set("X-API-Key", firstKey);
    assert.strictEqual(limited.status, 429);
    assert.strictEqual(limited.body.error, "rate_limited");
  });
});
