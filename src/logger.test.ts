import { describe, it, afterEach } from "node:test";
import assert from "node:assert";
import type { DestinationStream } from "pino";
import { createLogger, logRequestCompletion, logServerCloseError } from "./logger.js";

type Capture = {
  stream: DestinationStream;
  lines: string[];
  records: () => Record<string, unknown>[];
};

function createCapture(): Capture {
  const lines: string[] = [];
  return {
    stream: {
      write(message: string) {
        lines.push(message);
      },
    },
    lines,
    records: () =>
      lines
        .join("")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

const originalNodeEnv = process.env.NODE_ENV;
const originalLogLevel = process.env.LOG_LEVEL;

afterEach(() => {
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  if (originalLogLevel === undefined) {
    delete process.env.LOG_LEVEL;
  } else {
    process.env.LOG_LEVEL = originalLogLevel;
  }
});

void describe("structured logger", () => {
  void it("defaults to silent in test mode", () => {
    process.env.NODE_ENV = "test";
    delete process.env.LOG_LEVEL;
    const capture = createCapture();
    const logger = createLogger({ destination: capture.stream });

    logger.info({ event: "test-mode" }, "should be quiet");

    assert.deepStrictEqual(capture.records(), []);
  });

  void it("honors log level filtering", () => {
    const capture = createCapture();
    const logger = createLogger({ destination: capture.stream, level: "warn" });

    logger.info({ event: "ignored" }, "below threshold");
    logger.error({ event: "kept" }, "at threshold");

    const records = capture.records();
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0]?.event, "kept");
    assert.strictEqual(records[0]?.level, 50);
  });

  void it("redacts API keys and generated key fields", () => {
    const capture = createCapture();
    const logger = createLogger({ destination: capture.stream, level: "info" });

    logger.info(
      {
        apiKey: "tenant-secret",
        generatedKey: "generated-secret",
        key: "returned-secret",
        headers: { "x-api-key": "header-secret" },
        req: { headers: { "x-api-key": "nested-header-secret" } },
      },
      "redaction check"
    );

    const output = capture.lines.join("");
    assert.doesNotMatch(output, /tenant-secret/);
    assert.doesNotMatch(output, /generated-secret/);
    assert.doesNotMatch(output, /returned-secret/);
    assert.doesNotMatch(output, /header-secret/);
    assert.doesNotMatch(output, /nested-header-secret/);
    assert.match(output, /\[Redacted\]/);
  });

  void it("logs request completion with requestId correlation fields", () => {
    const capture = createCapture();
    const logger = createLogger({ destination: capture.stream, level: "info" });

    logRequestCompletion(logger, {
      requestId: "req-123",
      method: "POST",
      path: "/api/v1/usage",
      status: 201,
      durationMs: 12.3,
    });

    const [record] = capture.records();
    assert.strictEqual(record?.requestId, "req-123");
    assert.strictEqual(record?.method, "POST");
    assert.strictEqual(record?.path, "/api/v1/usage");
    assert.strictEqual(record?.status, 201);
    assert.strictEqual(record?.durationMs, 12.3);
    assert.strictEqual(record?.msg, "request completed");
  });

  void it("serializes shutdown errors without leaking keys", () => {
    const capture = createCapture();
    const logger = createLogger({ destination: capture.stream, level: "error" });

    logServerCloseError(
      logger,
      Object.assign(new Error("close failed"), {
        apiKey: "error-secret",
      })
    );

    const output = capture.lines.join("");
    assert.match(output, /close failed/);
    assert.doesNotMatch(output, /error-secret/);
    const [record] = capture.records();
    assert.strictEqual(record?.msg, "server close failed");
    assert.strictEqual(record?.level, 50);
  });
});
