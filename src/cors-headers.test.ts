import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import type { IncomingHttpHeaders } from "node:http";
import type { Application } from "express";
import request from "supertest";

const originalCorsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS;
const allowedOrigin = "https://app.agentpay.test";
const secondAllowedOrigin = "https://console.agentpay.test";

async function createCorsConfiguredApp(
  origins = `${allowedOrigin}, ${secondAllowedOrigin}`
): Promise<Application> {
  process.env.CORS_ALLOWED_ORIGINS = origins;
  const { createApp } = await import("./index.js");
  return createApp();
}

function restoreCorsEnv(): void {
  if (originalCorsAllowedOrigins === undefined) {
    delete process.env.CORS_ALLOWED_ORIGINS;
    return;
  }
  process.env.CORS_ALLOWED_ORIGINS = originalCorsAllowedOrigins;
}

function assertCorsReflection(headers: IncomingHttpHeaders): void {
  assert.strictEqual(headers["access-control-allow-origin"], allowedOrigin);
  assert.strictEqual(headers.vary, "Origin");
  assert.strictEqual(
    headers["access-control-allow-methods"],
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  assert.strictEqual(
    headers["access-control-allow-headers"],
    "Content-Type,X-Request-Id,X-API-Key"
  );
  assert.strictEqual(headers["access-control-max-age"], "86400");
}

function assertSecurityHeaders(headers: IncomingHttpHeaders): void {
  assert.strictEqual(headers["x-content-type-options"], "nosniff");
  assert.strictEqual(headers["x-frame-options"], "DENY");
  assert.strictEqual(headers["referrer-policy"], "no-referrer");
  assert.strictEqual(
    headers["strict-transport-security"],
    "max-age=63072000; includeSubDomains; preload"
  );
  assert.strictEqual(
    headers["permissions-policy"],
    "geolocation=(), camera=(), microphone=()"
  );
}

afterEach(() => {
  restoreCorsEnv();
});

void describe("CORS and security headers", () => {
  void it("reflects an allowlisted origin with Vary and access-control headers", async () => {
    const app = await createCorsConfiguredApp();

    const res = await request(app).get("/health").set("Origin", allowedOrigin);

    assert.strictEqual(res.status, 200);
    assertCorsReflection(res.headers);
  });

  void it("does not reflect disallowed or missing origins", async () => {
    const app = await createCorsConfiguredApp();

    const disallowed = await request(app)
      .get("/health")
      .set("Origin", "https://attacker.example");
    assert.strictEqual(disallowed.status, 200);
    assert.strictEqual(disallowed.headers["access-control-allow-origin"], undefined);
    assert.strictEqual(disallowed.headers.vary, undefined);

    const missing = await request(app).get("/health");
    assert.strictEqual(missing.status, 200);
    assert.strictEqual(missing.headers["access-control-allow-origin"], undefined);
    assert.strictEqual(missing.headers.vary, undefined);
  });

  void it("short-circuits OPTIONS preflight requests with a 204 response", async () => {
    const app = await createCorsConfiguredApp();

    const preflight = await request(app)
      .options("/api/v1/usage")
      .set("Origin", allowedOrigin)
      .set("Access-Control-Request-Method", "POST");

    assert.strictEqual(preflight.status, 204);
    assert.strictEqual(preflight.text, "");
    assertCorsReflection(preflight.headers);

    const unknownRoutePreflight = await request(app)
      .options("/api/v1/not-a-real-route")
      .set("Origin", allowedOrigin);
    assert.strictEqual(unknownRoutePreflight.status, 204);
    assertCorsReflection(unknownRoutePreflight.headers);
  });

  void it("keeps exact security headers on JSON, CSV, and text responses", async () => {
    const app = await createCorsConfiguredApp();

    const json = await request(app).get("/health");
    assert.strictEqual(json.status, 200);
    assert.ok(json.headers["content-type"]?.startsWith("application/json"));
    assertSecurityHeaders(json.headers);

    const csv = await request(app).get("/api/v1/usage/export.csv");
    assert.strictEqual(csv.status, 200);
    assert.ok(csv.headers["content-type"]?.startsWith("text/csv"));
    assertSecurityHeaders(csv.headers);

    const metrics = await request(app).get("/api/v1/metrics");
    assert.strictEqual(metrics.status, 200);
    assert.ok(metrics.headers["content-type"]?.startsWith("text/plain"));
    assertSecurityHeaders(metrics.headers);
  });
});
