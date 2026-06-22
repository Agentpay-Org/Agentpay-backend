import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request, { type Response } from "supertest";
import { app } from "./index.js";

const RATE_LIMIT_PER_WINDOW = 60;

type ErrorEnvelope = {
  error?: unknown;
  message?: unknown;
  requestId?: unknown;
};

function assertErrorEnvelope(
  res: Response,
  expected: { status: number; error: string }
) {
  assert.strictEqual(res.status, expected.status);
  const body = res.body as ErrorEnvelope;
  assert.strictEqual(body.error, expected.error);
  assert.strictEqual(typeof body.message, "string");
  assert.ok((body.message as string).length > 0);
  assert.strictEqual(typeof body.requestId, "string");
  assert.ok((body.requestId as string).length > 0);
  assert.strictEqual(res.headers["x-request-id"], body.requestId);
  return body;
}

function restoreNodeEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env.NODE_ENV;
    return;
  }
  process.env.NODE_ENV = value;
}

beforeEach(async () => {
  await request(app).post("/api/v1/admin/unpause");
});

afterEach(async () => {
  restoreNodeEnv("test");
  await request(app).post("/api/v1/admin/unpause");
});

void describe("Protective middleware", () => {
  void it("allows GET requests up to the rate limit and returns 429 on the next request", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const originalConsoleLog = console.log;

    try {
      process.env.NODE_ENV = "production";
      console.log = () => undefined;

      for (let i = 0; i < RATE_LIMIT_PER_WINDOW; i += 1) {
        const res = await request(app)
          .get("/health")
          .set("X-Request-Id", `rate-limit-${i}`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers["x-request-id"], `rate-limit-${i}`);
      }

      const limited = await request(app)
        .get("/health")
        .set("X-Request-Id", "rate-limit-over");
      const body = assertErrorEnvelope(limited, {
        status: 429,
        error: "rate_limited",
      });
      assert.strictEqual(limited.headers["retry-after"], "60");
      assert.strictEqual(body.requestId, "rate-limit-over");
    } finally {
      console.log = originalConsoleLog;
      restoreNodeEnv(previousNodeEnv);
    }
  });

  void it("blocks paused writes with 503 while allowing reads, OPTIONS, and unpause recovery", async () => {
    const initial = await request(app).get("/api/v1/admin/status");
    assert.strictEqual(initial.status, 200);
    assert.strictEqual(initial.body.paused, false);

    const pause = await request(app).post("/api/v1/admin/pause");
    assert.strictEqual(pause.status, 200);
    assert.strictEqual(pause.body.paused, true);

    const status = await request(app).get("/api/v1/admin/status");
    assert.strictEqual(status.status, 200);
    assert.strictEqual(status.body.paused, true);

    const blocked = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "paused-agent", serviceId: "svc-paused", requests: 1 });
    assertErrorEnvelope(blocked, { status: 503, error: "service_paused" });

    const read = await request(app).get("/health");
    assert.strictEqual(read.status, 200);

    const head = await request(app).head("/health");
    assert.strictEqual(head.status, 200);

    const options = await request(app).options("/api/v1/usage");
    assert.strictEqual(options.status, 204);

    const pathTrick = await request(app).post("/api/v1/admin/unpause%2F");
    assertErrorEnvelope(pathTrick, { status: 503, error: "service_paused" });

    const unpause = await request(app).post("/api/v1/admin/unpause");
    assert.strictEqual(unpause.status, 200);
    assert.strictEqual(unpause.body.paused, false);

    const recovered = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "paused-agent", serviceId: "svc-paused", requests: 1 });
    assert.strictEqual(recovered.status, 201);
  });
});
