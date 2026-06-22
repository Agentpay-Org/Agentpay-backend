import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

function labels(values: Record<string, string>) {
  return Object.entries(values)
    .map(([name, value]) => `${name}="${value}"`)
    .join(",");
}

function metricValue(
  text: string,
  name: string,
  metricLabels?: Record<string, string>
) {
  const prefix = metricLabels ? `${name}{${labels(metricLabels)}} ` : `${name} `;
  const line = text.split("\n").find((candidate) => candidate.startsWith(prefix));
  if (!line) return 0;
  return Number(line.slice(prefix.length));
}

async function metricsText() {
  const res = await request(app).get("/api/v1/metrics");
  assert.strictEqual(res.status, 200);
  assert.ok(res.headers["content-type"].startsWith("text/plain"));
  return res.text;
}

void describe("Prometheus metrics", () => {
  void it("records request counters and duration histograms by route pattern", async () => {
    const metricLabels = { method: "GET", route: "/health", status: "200" };
    const before = await metricsText();

    const health = await request(app).get("/health");
    assert.strictEqual(health.status, 200);

    const after = await metricsText();
    assert.strictEqual(
      metricValue(after, "agentpay_http_requests_total", metricLabels),
      metricValue(before, "agentpay_http_requests_total", metricLabels) + 1
    );
    assert.strictEqual(
      metricValue(after, "agentpay_http_request_duration_seconds_count", metricLabels),
      metricValue(
        before,
        "agentpay_http_request_duration_seconds_count",
        metricLabels
      ) + 1
    );
    assert.ok(
      metricValue(after, "agentpay_http_request_duration_seconds_sum", metricLabels) >
        metricValue(before, "agentpay_http_request_duration_seconds_sum", metricLabels)
    );
    assert.strictEqual(
      metricValue(after, "agentpay_http_request_duration_seconds_bucket", {
        ...metricLabels,
        le: "+Inf",
      }),
      metricValue(before, "agentpay_http_request_duration_seconds_bucket", {
        ...metricLabels,
        le: "+Inf",
      }) + 1
    );
  });

  void it("uses unmatched instead of raw paths for unknown routes", async () => {
    const metricLabels = { method: "GET", route: "unmatched", status: "404" };
    const before = await metricsText();

    const missing = await request(app).get("/api/v1/not-a-real-route");
    assert.strictEqual(missing.status, 404);

    const after = await metricsText();
    assert.strictEqual(
      metricValue(after, "agentpay_http_requests_total", metricLabels),
      metricValue(before, "agentpay_http_requests_total", metricLabels) + 1
    );
    assert.ok(!after.includes("/api/v1/not-a-real-route"));
  });

  void it("increments the final error handler counter", async () => {
    const before = await metricsText();
    const oversized = "x".repeat(110 * 1024);

    const res = await request(app)
      .post("/api/v1/usage")
      .set("Content-Type", "application/json")
      .send({ agent: oversized, serviceId: "svc", requests: 1 });
    assert.strictEqual(res.status, 413);

    const after = await metricsText();
    assert.strictEqual(
      metricValue(after, "agentpay_http_errors_total"),
      metricValue(before, "agentpay_http_errors_total") + 1
    );
    assert.strictEqual(
      metricValue(after, "agentpay_http_requests_total", {
        method: "POST",
        route: "unmatched",
        status: "413",
      }),
      metricValue(before, "agentpay_http_requests_total", {
        method: "POST",
        route: "unmatched",
        status: "413",
      }) + 1
    );
  });
});
