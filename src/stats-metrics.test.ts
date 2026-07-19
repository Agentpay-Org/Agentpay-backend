import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { eventLog } from "./events.js";
import { createApp } from "./index.js";
import {
  apiKeyStore,
  config,
  pauseState,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
  webhookStore,
} from "./store/state.js";

const defaultConfig = {
  rateLimitPerWindow: 60,
  rateLimitWindowMs: 60_000,
  bulkMaxItems: 100,
  eventLogCap: 10_000,
};

beforeEach(() => {
  apiKeyStore.clear();
  eventLog.length = 0;
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  pauseState.paused = false;
  Object.assign(config, defaultConfig);
});

function metricValue(text: string, metric: string): number {
  const line = text.split("\n").find((candidate) => candidate.startsWith(`${metric} `));
  if (!line) throw new Error(`missing metric ${metric}`);
  return Number(line.slice(metric.length + 1));
}

function contentTypeParts(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(";")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
  );
}

void describe("stats and prometheus metrics", () => {
  void it("reports an empty stats snapshot deterministically", async () => {
    const app = createApp();

    const stats = await request(app).get("/api/v1/stats");

    assert.strictEqual(stats.status, 200);
    assert.deepStrictEqual(stats.body, {
      totalServices: 0,
      totalApiKeys: 0,
      totalRequests: 0,
      uniqueAgents: 0,
      paused: false,
    });
  });

  void it("aggregates services, keys, requests, and distinct agents", async () => {
    const app = createApp();
    servicesStore.set("svc-a", { priceStroops: 3 });
    servicesStore.set("svc-b", { priceStroops: 5 });
    apiKeyStore.set("apk_one", { label: "one", createdAt: 1, prefix: "apk_one" });
    apiKeyStore.set("apk_two", { label: "two", createdAt: 2, prefix: "apk_two" });
    usageStore.set("agent-a::svc-a", 4);
    usageStore.set("agent-a::svc-b", 6);
    usageStore.set("agent-b::svc-a", 9);

    const stats = await request(app).get("/api/v1/stats");

    assert.strictEqual(stats.status, 200);
    assert.strictEqual(stats.body.totalServices, 2);
    assert.strictEqual(stats.body.totalApiKeys, 2);
    assert.strictEqual(stats.body.totalRequests, 19);
    assert.strictEqual(stats.body.uniqueAgents, 2);
    assert.strictEqual(stats.body.paused, false);
  });

  void it("emits prometheus gauges with help/type lines and text format", async () => {
    const app = createApp();
    servicesStore.set("svc-a", { priceStroops: 3 });
    servicesStore.set("svc-b", { priceStroops: 5 });
    apiKeyStore.set("apk_one", { label: "one", createdAt: 1, prefix: "apk_one" });
    usageStore.set("agent-a::svc-a", 4);
    usageStore.set("agent-b::svc-b", 8);

    const metrics = await request(app).get("/api/v1/metrics");
    const contentType = contentTypeParts(metrics.headers["content-type"]);

    assert.strictEqual(metrics.status, 200);
    assert.ok(contentType.has("text/plain"));
    assert.ok(contentType.has("version=0.0.4"));
    for (const metric of [
      "agentpay_services_total",
      "agentpay_api_keys_total",
      "agentpay_usage_requests_total",
      "agentpay_paused",
    ]) {
      assert.ok(metrics.text.includes(`# HELP ${metric} `));
      assert.ok(metrics.text.includes(`# TYPE ${metric} gauge`));
    }
    assert.strictEqual(metricValue(metrics.text, "agentpay_services_total"), 2);
    assert.strictEqual(metricValue(metrics.text, "agentpay_api_keys_total"), 1);
    assert.strictEqual(metricValue(metrics.text, "agentpay_usage_requests_total"), 12);
    assert.strictEqual(metricValue(metrics.text, "agentpay_paused"), 0);
    assert.ok(!metrics.text.includes("agent-a"));
    assert.ok(!metrics.text.includes("agent-b"));
    assert.ok(!metrics.text.includes("apk_one"));
    assert.ok(metrics.text.endsWith("\n"));
  });

  void it("flips the paused gauge after the admin pause endpoint", async () => {
    const app = createApp();

    const before = await request(app).get("/api/v1/metrics");
    await request(app).post("/api/v1/admin/pause");
    const after = await request(app).get("/api/v1/metrics");

    assert.strictEqual(metricValue(before.text, "agentpay_paused"), 0);
    assert.strictEqual(metricValue(after.text, "agentpay_paused"), 1);
  });
});
