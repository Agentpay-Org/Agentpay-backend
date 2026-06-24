import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import type { Application } from "express";
import request from "supertest";
import { parseCorsOrigins } from "./middleware/index.js";

const originalCorsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS;

async function createAppWithCors(origins: string): Promise<Application> {
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

afterEach(() => {
  restoreCorsEnv();
});

void describe("CORS allowlist hardening", () => {
  void it("normalizes whitespace, case, ports, and a single trailing slash", () => {
    const warnings: string[] = [];

    const parsed = parseCorsOrigins(
      " https://Example.COM/, HTTP://LocalHost:3000 ,https://api.example.com ",
      (message) => warnings.push(message)
    );

    assert.deepStrictEqual(Array.from(parsed).sort(), [
      "http://localhost:3000",
      "https://api.example.com",
      "https://example.com",
    ]);
    assert.deepStrictEqual(warnings, []);
  });

  void it("logs and skips malformed entries without poisoning valid origins", () => {
    const warnings: string[] = [];

    const parsed = parseCorsOrigins(
      "https://valid.example,not-a-url,ftp://files.example,https://bad.example/path",
      (message) => warnings.push(message)
    );

    assert.deepStrictEqual(Array.from(parsed), ["https://valid.example"]);
    assert.strictEqual(warnings.length, 3);
    assert.ok(warnings.every((message) => message.includes("Skipping invalid")));
  });

  void it("rejects wildcard configuration with a clear startup error", () => {
    assert.throws(
      () => parseCorsOrigins("https://valid.example,*"),
      /does not support '\*'/
    );
  });

  void it("reflects only normalized allowlisted origins", async () => {
    const app = await createAppWithCors(" https://Example.com/ ");

    const allowed = await request(app)
      .get("/health")
      .set("Origin", "https://EXAMPLE.com/");
    assert.strictEqual(allowed.status, 200);
    assert.strictEqual(
      allowed.headers["access-control-allow-origin"],
      "https://example.com"
    );
    assert.strictEqual(allowed.headers.vary, "Origin");

    const disallowed = await request(app)
      .get("/health")
      .set("Origin", "https://attacker.example");
    assert.strictEqual(disallowed.status, 200);
    assert.strictEqual(disallowed.headers["access-control-allow-origin"], undefined);
    assert.strictEqual(
      disallowed.headers["access-control-allow-credentials"],
      undefined
    );
  });

  void it("keeps empty config same-origin only and still short-circuits preflight", async () => {
    const app = await createAppWithCors("");

    const get = await request(app).get("/health").set("Origin", "https://app.example");
    assert.strictEqual(get.status, 200);
    assert.strictEqual(get.headers["access-control-allow-origin"], undefined);

    const preflight = await request(app)
      .options("/api/v1/usage")
      .set("Origin", "https://app.example");
    assert.strictEqual(preflight.status, 204);
    assert.strictEqual(preflight.headers["access-control-allow-origin"], undefined);
  });
});
