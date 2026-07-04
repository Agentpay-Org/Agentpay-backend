import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { eventLog } from "./events.js";
import { resetHttpMetrics } from "./metrics.js";
import {
  apiKeyStore,
  pauseState,
  rateBuckets,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
  webhookStore,
} from "./store/state.js";

beforeEach(() => {
  apiKeyStore.clear();
  eventLog.length = 0;
  rateBuckets.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  pauseState.paused = false;
  resetHttpMetrics();
});

void describe("Prometheus HTTP metrics", () => {
  void it("records request counters and duration histograms by method, route, and status", async () => {
    const app = createApp();

    const write = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-metrics", serviceId: "svc-metrics", requests: 3 });
    assert.strictEqual(write.status, 201);

    const read = await request(app).get("/api/v1/usage/agent-metrics/svc-metrics");
    assert.strictEqual(read.status, 200);

    const metrics = await request(app).get("/api/v1/metrics");
    assert.strictEqual(metrics.status, 200);
    assert.match(
      metrics.text,
      /agentpay_http_requests_total\{method="POST",route="\/api\/v1\/usage",status="201"\} 1/
    );
    assert.match(
      metrics.text,
      /agentpay_http_requests_total\{method="GET",route="\/api\/v1\/usage\/:agent\/:serviceId",status="200"\} 1/
    );
    assert.match(
      metrics.text,
      /agentpay_http_request_duration_seconds_count\{method="POST",route="\/api\/v1\/usage",status="201"\} 1/
    );
    assert.match(
      metrics.text,
      /agentpay_http_request_duration_seconds_bucket\{method="POST",route="\/api\/v1\/usage",status="201",le="0\.5"\} 1/
    );
  });

  void it("uses bounded route-pattern labels instead of raw request paths", async () => {
    const app = createApp();

    await request(app).get("/api/v1/usage/raw-agent/raw-service");

    const metrics = await request(app).get("/api/v1/metrics");
    assert.strictEqual(metrics.status, 200);
    assert.ok(metrics.text.includes('route="/api/v1/usage/:agent/:serviceId"'));
    assert.ok(!metrics.text.includes("raw-agent"));
    assert.ok(!metrics.text.includes("raw-service"));
  });

  void it("increments the terminal error counter when the error handler runs", async () => {
    const app = createApp();

    const bad = await request(app)
      .post("/api/v1/usage")
      .set("Content-Type", "application/json")
      .send("{not-json");
    assert.strictEqual(bad.status, 500);

    const metrics = await request(app).get("/api/v1/metrics");
    assert.strictEqual(metrics.status, 200);
    assert.match(
      metrics.text,
      /agentpay_http_errors_total\{type="entity\.parse\.failed"\} 1/
    );
    assert.match(
      metrics.text,
      /agentpay_http_requests_total\{method="POST",route="unmatched",status="500"\} 1/
    );
  });
});
