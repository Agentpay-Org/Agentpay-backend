import { describe, it } from "node:test";
import assert from "node:assert";
import { type DestinationStream } from "pino";
import { createLogger } from "./logger.js";

function captureStream() {
  const chunks: string[] = [];
  const stream: DestinationStream = {
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
  };
  return { chunks, stream };
}

function logLines(chunks: string[]) {
  return chunks
    .join("")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

void describe("logger", () => {
  void it("honors LOG_LEVEL-style filtering", () => {
    const { chunks, stream } = captureStream();
    const testLogger = createLogger({ level: "warn", nodeEnv: "production", stream });

    testLogger.info({ requestId: "req-hidden" }, "hidden");
    testLogger.warn({ requestId: "req-visible" }, "visible");

    const lines = logLines(chunks);
    assert.strictEqual(lines.length, 1);
    assert.strictEqual(lines[0].msg, "visible");
    assert.strictEqual(lines[0].requestId, "req-visible");
  });

  void it("defaults to silent in test mode", () => {
    const { chunks, stream } = captureStream();
    const testLogger = createLogger({ nodeEnv: "test", stream });

    testLogger.error({ requestId: "req-test" }, "quiet");

    assert.deepStrictEqual(chunks, []);
  });

  void it("redacts api keys and generated key fields", () => {
    const { chunks, stream } = captureStream();
    const testLogger = createLogger({ level: "info", nodeEnv: "production", stream });

    testLogger.info(
      {
        requestId: "req-redact",
        key: "apk_top_level_secret",
        apiKey: "apk_api_key_secret",
        headers: {
          authorization: "Bearer auth_secret",
          "x-api-key": "header_secret",
        },
        result: {
          key: "apk_nested_secret",
        },
      },
      "redacted"
    );

    const output = chunks.join("");
    assert.ok(!output.includes("apk_top_level_secret"));
    assert.ok(!output.includes("apk_api_key_secret"));
    assert.ok(!output.includes("auth_secret"));
    assert.ok(!output.includes("header_secret"));
    assert.ok(!output.includes("apk_nested_secret"));
    assert.ok(output.includes("[Redacted]"));
  });

  void it("keeps request correlation fields in structured output", () => {
    const { chunks, stream } = captureStream();
    const testLogger = createLogger({ level: "info", nodeEnv: "production", stream });

    testLogger.info(
      {
        requestId: "req-correlation",
        method: "GET",
        path: "/health",
        status: 200,
        durationMs: 1.2,
      },
      "request completed"
    );

    const [line] = logLines(chunks);
    assert.strictEqual(line.requestId, "req-correlation");
    assert.strictEqual(line.method, "GET");
    assert.strictEqual(line.path, "/health");
    assert.strictEqual(line.status, 200);
    assert.strictEqual(line.msg, "request completed");
  });
});
