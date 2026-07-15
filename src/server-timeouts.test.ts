import assert from "node:assert";
import { createServer } from "node:http";
import { describe, it } from "node:test";
import { configureServerTimeouts, DEFAULT_SERVER_TIMEOUTS } from "./index.js";

void describe("server timeout hardening", () => {
  void it("applies safe defaults to request, header, keep-alive, and socket timeouts", () => {
    const server = createServer();

    configureServerTimeouts(server, {});

    assert.strictEqual(server.requestTimeout, DEFAULT_SERVER_TIMEOUTS.requestTimeoutMs);
    assert.strictEqual(server.headersTimeout, DEFAULT_SERVER_TIMEOUTS.headersTimeoutMs);
    assert.strictEqual(
      server.keepAliveTimeout,
      DEFAULT_SERVER_TIMEOUTS.keepAliveTimeoutMs
    );
    assert.strictEqual(server.timeout, DEFAULT_SERVER_TIMEOUTS.requestTimeoutMs);
  });

  void it("uses positive integer environment overrides", () => {
    const server = createServer();

    configureServerTimeouts(server, {
      REQUEST_TIMEOUT_MS: "45000",
      HEADERS_TIMEOUT_MS: "12000",
      KEEPALIVE_TIMEOUT_MS: "7000",
    });

    assert.strictEqual(server.requestTimeout, 45_000);
    assert.strictEqual(server.headersTimeout, 12_000);
    assert.strictEqual(server.keepAliveTimeout, 7_000);
    assert.strictEqual(server.timeout, 45_000);
  });

  void it("ignores missing, non-integer, zero, and negative overrides", () => {
    const server = createServer();

    configureServerTimeouts(server, {
      REQUEST_TIMEOUT_MS: "0",
      HEADERS_TIMEOUT_MS: "12.5",
      KEEPALIVE_TIMEOUT_MS: "-1",
    });

    assert.strictEqual(server.requestTimeout, DEFAULT_SERVER_TIMEOUTS.requestTimeoutMs);
    assert.strictEqual(server.headersTimeout, DEFAULT_SERVER_TIMEOUTS.headersTimeoutMs);
    assert.strictEqual(
      server.keepAliveTimeout,
      DEFAULT_SERVER_TIMEOUTS.keepAliveTimeoutMs
    );
  });

  void it("keeps headersTimeout greater than or equal to keepAliveTimeout", () => {
    const server = createServer();

    configureServerTimeouts(server, {
      HEADERS_TIMEOUT_MS: "4000",
      KEEPALIVE_TIMEOUT_MS: "9000",
    });

    assert.strictEqual(server.keepAliveTimeout, 9_000);
    assert.strictEqual(server.headersTimeout, 9_000);
  });
});
