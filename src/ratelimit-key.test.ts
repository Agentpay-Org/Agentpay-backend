import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request, { type Response } from "supertest";
import { app, trustProxySettingFromEnv } from "./index.js";

const originalConsoleLog = console.log;
const originalNodeEnv = process.env.NODE_ENV;
const originalTrustProxy = app.get("trust proxy") as unknown;
const RATE_LIMIT_PER_WINDOW = 60;

type ErrorEnvelope = {
  error?: unknown;
  requestId?: unknown;
};

function restoreNodeEnv() {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
    return;
  }
  process.env.NODE_ENV = originalNodeEnv;
}

function enterProductionMode() {
  process.env.NODE_ENV = "production";
  console.log = () => undefined;
}

function restoreRuntime() {
  console.log = originalConsoleLog;
  restoreNodeEnv();
  app.set("trust proxy", originalTrustProxy);
}

async function createApiKey(label: string) {
  const res = await request(app).post("/api/v1/api-keys").send({ label });
  assert.strictEqual(res.status, 201);
  return res.body.key as string;
}

function assertRateLimited(res: Response, requestId: string) {
  assert.strictEqual(res.status, 429);
  const body = res.body as ErrorEnvelope;
  assert.strictEqual(body.error, "rate_limited");
  assert.strictEqual(body.requestId, requestId);
  assert.strictEqual(res.headers["x-request-id"], requestId);
  assert.strictEqual(res.headers["retry-after"], "60");
}

async function getHealth(requestId: string, headers: Record<string, string> = {}) {
  const req = request(app).get("/health").set("X-Request-Id", requestId);
  for (const [name, value] of Object.entries(headers)) {
    req.set(name, value);
  }
  return req;
}

beforeEach(async () => {
  restoreRuntime();
  await request(app).post("/api/v1/admin/unpause");
});

afterEach(() => {
  restoreRuntime();
});

void describe("Rate limit key derivation", () => {
  void it("parses TRUST_PROXY values with a safe default", () => {
    assert.strictEqual(trustProxySettingFromEnv(undefined), false);
    assert.strictEqual(trustProxySettingFromEnv(""), false);
    assert.strictEqual(trustProxySettingFromEnv("false"), false);
    assert.strictEqual(trustProxySettingFromEnv("0"), false);
    assert.strictEqual(trustProxySettingFromEnv("true"), 1);
    assert.strictEqual(trustProxySettingFromEnv("yes"), 1);
    assert.strictEqual(trustProxySettingFromEnv("2"), 2);
    assert.strictEqual(trustProxySettingFromEnv("invalid"), false);
  });

  void it("uses trusted X-Forwarded-For only when trust proxy is enabled", async () => {
    enterProductionMode();
    app.set("trust proxy", 1);

    const firstClient = "198.51.100.11";
    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i += 1) {
      const res = await getHealth(`trusted-xff-${i}`, {
        "X-Forwarded-For": firstClient,
      });
      assert.strictEqual(res.status, 200);
    }

    const limited = await getHealth("trusted-xff-limited", {
      "X-Forwarded-For": firstClient,
    });
    assertRateLimited(limited, "trusted-xff-limited");

    const otherClient = await getHealth("trusted-xff-other", {
      "X-Forwarded-For": "198.51.100.12",
    });
    assert.strictEqual(otherClient.status, 200);
  });

  void it("keys by API key before IP so authenticated callers are isolated", async () => {
    const firstKey = await createApiKey("first-rate-key-test");
    const secondKey = await createApiKey("second-rate-key-test");

    enterProductionMode();
    app.set("trust proxy", false);

    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i += 1) {
      const res = await getHealth(`api-key-rate-${i}`, { "X-API-Key": firstKey });
      assert.strictEqual(res.status, 200);
    }

    const limited = await getHealth("api-key-rate-limited", {
      "X-API-Key": firstKey,
    });
    assertRateLimited(limited, "api-key-rate-limited");

    const secondCaller = await getHealth("api-key-rate-second", {
      "X-API-Key": secondKey,
    });
    assert.strictEqual(secondCaller.status, 200);
  });

  void it("ignores spoofed X-Forwarded-For when trust proxy is disabled", async () => {
    enterProductionMode();
    app.set("trust proxy", false);

    for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i += 1) {
      const res = await getHealth(`untrusted-xff-${i}`, {
        "X-Forwarded-For": `203.0.113.${i}`,
      });
      assert.strictEqual(res.status, 200);
    }

    const limited = await getHealth("untrusted-xff-limited", {
      "X-Forwarded-For": "203.0.113.250",
    });
    assertRateLimited(limited, "untrusted-xff-limited");
  });
});
