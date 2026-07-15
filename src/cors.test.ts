import assert from "node:assert";
import { describe, it } from "node:test";
import request from "supertest";
import { createApp } from "./index.js";

function withCorsAllowedOrigins<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.CORS_ALLOWED_ORIGINS;
  if (value === undefined) {
    delete process.env.CORS_ALLOWED_ORIGINS;
  } else {
    process.env.CORS_ALLOWED_ORIGINS = value;
  }

  try {
    return fn();
  } finally {
    if (previous === undefined) {
      delete process.env.CORS_ALLOWED_ORIGINS;
    } else {
      process.env.CORS_ALLOWED_ORIGINS = previous;
    }
  }
}

void describe("CORS origin allowlist", () => {
  void it("normalizes configured origins before matching request origins", async () => {
    const app = withCorsAllowedOrigins(" https://APP.example.com/ ", () => createApp());

    const res = await request(app)
      .options("/api/v1/version")
      .set("Origin", "https://app.example.com");

    assert.strictEqual(res.status, 204);
    assert.strictEqual(
      res.headers["access-control-allow-origin"],
      "https://app.example.com"
    );
    assert.strictEqual(res.headers.vary, "Origin");
  });

  void it("does not reflect unlisted origins", async () => {
    const app = withCorsAllowedOrigins("https://app.example.com", () => createApp());

    const res = await request(app)
      .options("/api/v1/version")
      .set("Origin", "https://evil.example.com");

    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers["access-control-allow-origin"], undefined);
    assert.strictEqual(res.headers.vary, "Origin");
  });

  void it("logs and skips malformed allowlist entries while keeping valid entries", async () => {
    const warnings: string[] = [];
    const previousWarn = console.warn;
    console.warn = (message?: unknown) => {
      warnings.push(String(message));
    };

    let app: ReturnType<typeof createApp>;
    try {
      app = withCorsAllowedOrigins(
        "not a url, https://api.example.com/path, https://app.example.com",
        () => createApp()
      );
    } finally {
      console.warn = previousWarn;
    }

    const malformed = await request(app)
      .options("/api/v1/version")
      .set("Origin", "https://api.example.com");
    const valid = await request(app)
      .options("/api/v1/version")
      .set("Origin", "https://app.example.com");

    assert.strictEqual(malformed.headers["access-control-allow-origin"], undefined);
    assert.strictEqual(
      valid.headers["access-control-allow-origin"],
      "https://app.example.com"
    );
    assert.deepStrictEqual(warnings, [
      "Ignoring malformed CORS origin in CORS_ALLOWED_ORIGINS: not a url",
      "Ignoring malformed CORS origin in CORS_ALLOWED_ORIGINS: https://api.example.com/path",
    ]);
  });

  void it("rejects wildcard allowlist configuration at startup", () => {
    assert.throws(
      () => withCorsAllowedOrigins("*", () => createApp()),
      /CORS_ALLOWED_ORIGINS.*wildcard/i
    );
  });
});
