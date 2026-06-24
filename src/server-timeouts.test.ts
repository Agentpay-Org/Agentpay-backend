import { createServer } from "node:http";
import { describe, it } from "node:test";
import assert from "node:assert";
import { configureServerTimeouts } from "./serverTimeouts.js";

void describe("server timeout configuration", () => {
  void it("applies safe defaults when env overrides are absent", () => {
    const server = createServer();
    try {
      const config = configureServerTimeouts(server, {});

      assert.deepStrictEqual(config, {
        requestTimeoutMs: 120_000,
        headersTimeoutMs: 65_000,
        keepAliveTimeoutMs: 5_000,
      });
      assert.strictEqual(server.requestTimeout, 120_000);
      assert.strictEqual(server.headersTimeout, 65_000);
      assert.strictEqual(server.keepAliveTimeout, 5_000);
      assert.strictEqual(server.timeout, 120_000);
    } finally {
      server.close();
    }
  });

  void it("uses positive integer env overrides", () => {
    const server = createServer();
    try {
      const config = configureServerTimeouts(server, {
        REQUEST_TIMEOUT_MS: "45000",
        HEADERS_TIMEOUT_MS: "15000",
        KEEPALIVE_TIMEOUT_MS: "10000",
      });

      assert.deepStrictEqual(config, {
        requestTimeoutMs: 45_000,
        headersTimeoutMs: 15_000,
        keepAliveTimeoutMs: 10_000,
      });
      assert.strictEqual(server.requestTimeout, 45_000);
      assert.strictEqual(server.headersTimeout, 15_000);
      assert.strictEqual(server.keepAliveTimeout, 10_000);
      assert.strictEqual(server.timeout, 45_000);
    } finally {
      server.close();
    }
  });

  void it("falls back on invalid env values", () => {
    const server = createServer();
    try {
      const config = configureServerTimeouts(server, {
        REQUEST_TIMEOUT_MS: "not-a-number",
        HEADERS_TIMEOUT_MS: "0",
        KEEPALIVE_TIMEOUT_MS: "-1",
      });

      assert.deepStrictEqual(config, {
        requestTimeoutMs: 120_000,
        headersTimeoutMs: 65_000,
        keepAliveTimeoutMs: 5_000,
      });
    } finally {
      server.close();
    }
  });

  void it("keeps headersTimeout greater than or equal to keepAliveTimeout", () => {
    const server = createServer();
    try {
      const config = configureServerTimeouts(server, {
        REQUEST_TIMEOUT_MS: "30000",
        HEADERS_TIMEOUT_MS: "5000",
        KEEPALIVE_TIMEOUT_MS: "20000",
      });

      assert.strictEqual(config.headersTimeoutMs, 20_000);
      assert.strictEqual(config.keepAliveTimeoutMs, 20_000);
      assert.ok(config.headersTimeoutMs >= config.keepAliveTimeoutMs);
      assert.strictEqual(server.headersTimeout, 20_000);
      assert.strictEqual(server.keepAliveTimeout, 20_000);
    } finally {
      server.close();
    }
  });
});
