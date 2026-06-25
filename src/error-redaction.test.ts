import { describe, it } from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { createApp } from "./index.js";
import { installPreRouteMiddleware } from "./middleware/index.js";
import { installErrorHandlers } from "./routes/errors.js";

function createThrowingApp(kind: "error" | "non-error") {
  const app = express();
  installPreRouteMiddleware(app);
  app.get("/boom", (_req, _res, next) => {
    if (kind === "error") {
      next(new Error("database password file at /var/secrets/prod.env failed"));
      return;
    }
    next("raw token abc123 from /srv/private/config");
  });
  installErrorHandlers(app);
  return app;
}

async function withCapturedConsoleError<T>(
  callback: (messages: string[]) => Promise<T>
): Promise<T> {
  const originalConsoleError = console.error;
  const messages: string[] = [];
  console.error = (...args: unknown[]) => {
    messages.push(args.map(String).join(" "));
  };
  try {
    return await callback(messages);
  } finally {
    console.error = originalConsoleError;
  }
}

void describe("error redaction", () => {
  void it("redacts sensitive Error messages from 500 responses while logging details", async () => {
    await withCapturedConsoleError(async (messages) => {
      const requestId = "redaction-test-error";
      const res = await request(createThrowingApp("error"))
        .get("/boom")
        .set("X-Request-Id", requestId);

      assert.strictEqual(res.status, 500);
      assert.deepStrictEqual(res.body, {
        error: "internal_error",
        message: "Unexpected server error",
        method: "GET",
        path: "/boom",
        requestId,
      });
      assert.ok(!res.text.includes("/var/secrets/prod.env"));
      assert.ok(!res.text.includes("database password file"));

      const logLine = messages.join("\n");
      assert.match(logLine, /redaction-test-error/);
      assert.match(
        logLine,
        /database password file at \/var\/secrets\/prod\.env failed/
      );
      assert.match(logLine, /Error: database password file/);
    });
  });

  void it("redacts non-Error thrown values from 500 responses while logging details", async () => {
    await withCapturedConsoleError(async (messages) => {
      const requestId = "redaction-test-non-error";
      const res = await request(createThrowingApp("non-error"))
        .get("/boom")
        .set("X-Request-Id", requestId);

      assert.strictEqual(res.status, 500);
      assert.strictEqual(res.body.error, "internal_error");
      assert.strictEqual(res.body.message, "Unexpected server error");
      assert.strictEqual(res.body.requestId, requestId);
      assert.ok(!res.text.includes("abc123"));
      assert.ok(!res.text.includes("/srv/private/config"));

      const logLine = messages.join("\n");
      assert.match(logLine, /redaction-test-non-error/);
      assert.match(logLine, /raw token abc123 from \/srv\/private\/config/);
    });
  });

  void it("keeps existing validation 400 responses caller-actionable", async () => {
    const res = await request(createApp())
      .post("/api/v1/usage")
      .send({ agent: "", serviceId: "weather", requests: 1 });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.match(
      res.body.message as string,
      /agent must be a non-empty string up to 256 chars/
    );
    assert.ok(res.body.requestId);
  });

  void it("keeps existing 413 payload-too-large responses stable", async () => {
    const res = await request(createApp())
      .post("/api/v1/usage")
      .send({ value: "x".repeat(101 * 1024) });

    assert.strictEqual(res.status, 413);
    assert.strictEqual(res.body.error, "payload_too_large");
    assert.strictEqual(res.body.message, "request body exceeds the 100 KiB limit");
  });
});
