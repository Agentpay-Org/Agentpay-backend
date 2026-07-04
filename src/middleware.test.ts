import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { pauseState, rateBuckets } from "./store/state.js";

async function withRuntimeRateLimit(fn: () => Promise<void>): Promise<void> {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalLog = console.log;
  process.env.NODE_ENV = "development";
  console.log = () => undefined;
  try {
    await fn();
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    console.log = originalLog;
  }
}

beforeEach(() => {
  pauseState.paused = false;
  rateBuckets.clear();
});

void describe("protective middleware", () => {
  void it("allows requests at the limit and returns 429 on the next request", async () => {
    await withRuntimeRateLimit(async () => {
      const app = createApp();

      for (let i = 0; i < 60; i++) {
        const response = await request(app).get("/health");
        assert.strictEqual(response.status, 200);
      }

      const blocked = await request(app).get("/health");
      assert.strictEqual(blocked.status, 429);
      assert.strictEqual(blocked.body.error, "rate_limited");
      assert.strictEqual(typeof blocked.body.message, "string");
      assert.strictEqual(typeof blocked.body.requestId, "string");
      assert.strictEqual(blocked.headers["retry-after"], "60");
    });
  });

  void it("blocks paused writes while allowing reads, head, options, and unpause recovery", async () => {
    const app = createApp();

    const pause = await request(app).post("/api/v1/admin/pause");
    assert.strictEqual(pause.status, 200);
    assert.strictEqual(pause.body.paused, true);

    const status = await request(app).get("/api/v1/admin/status");
    assert.strictEqual(status.status, 200);
    assert.strictEqual(status.body.paused, true);

    const blocked = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-paused", serviceId: "svc-paused", requests: 1 });
    assert.strictEqual(blocked.status, 503);
    assert.strictEqual(blocked.body.error, "service_paused");
    assert.strictEqual(typeof blocked.body.message, "string");
    assert.strictEqual(typeof blocked.body.requestId, "string");

    const get = await request(app).get("/health");
    assert.strictEqual(get.status, 200);

    const head = await request(app).head("/health");
    assert.strictEqual(head.status, 200);

    const options = await request(app).options("/api/v1/usage");
    assert.strictEqual(options.status, 204);

    const unpause = await request(app).post("/api/v1/admin/unpause");
    assert.strictEqual(unpause.status, 200);
    assert.strictEqual(unpause.body.paused, false);

    const recovered = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-paused", serviceId: "svc-paused", requests: 1 });
    assert.strictEqual(recovered.status, 201);
  });
});
