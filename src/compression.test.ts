import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { servicesStore, usageKey, usageStore } from "./store/state.js";

const originalCompression = process.env.COMPRESSION;
const originalThreshold = process.env.COMPRESSION_THRESHOLD_BYTES;

function configureCompression(threshold = 64): void {
  process.env.COMPRESSION = "on";
  process.env.COMPRESSION_THRESHOLD_BYTES = String(threshold);
}

function restoreCompressionEnv(): void {
  if (originalCompression === undefined) delete process.env.COMPRESSION;
  else process.env.COMPRESSION = originalCompression;

  if (originalThreshold === undefined) delete process.env.COMPRESSION_THRESHOLD_BYTES;
  else process.env.COMPRESSION_THRESHOLD_BYTES = originalThreshold;
}

beforeEach(() => {
  servicesStore.clear();
  usageStore.clear();
  restoreCompressionEnv();
});

afterEach(() => {
  restoreCompressionEnv();
});

void describe("response compression", () => {
  void it("negotiates gzip for large service list responses", async () => {
    configureCompression();
    for (let i = 0; i < 20; i++) {
      servicesStore.set(`svc-compress-${i.toString().padStart(2, "0")}`, {
        priceStroops: i + 1,
      });
    }

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/services?limit=1000")
      .set("Accept-Encoding", "gzip");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["content-encoding"], "gzip");
    assert.match(res.headers.vary, /Accept-Encoding/);
  });

  void it("leaves large responses uncompressed when the client requests identity", async () => {
    configureCompression();
    for (let i = 0; i < 20; i++) {
      servicesStore.set(`svc-plain-${i.toString().padStart(2, "0")}`, {
        priceStroops: i + 1,
      });
    }

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/services?limit=1000")
      .set("Accept-Encoding", "identity");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["content-encoding"], undefined);
  });

  void it("skips small responses below the configured threshold", async () => {
    configureCompression(4096);

    const app = createApp();
    const res = await request(app).get("/health").set("Accept-Encoding", "gzip");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["content-encoding"], undefined);
  });

  void it("can be disabled with COMPRESSION=off", async () => {
    process.env.COMPRESSION = "off";
    process.env.COMPRESSION_THRESHOLD_BYTES = "1";
    for (let i = 0; i < 20; i++) {
      servicesStore.set(`svc-off-${i.toString().padStart(2, "0")}`, {
        priceStroops: i + 1,
      });
    }

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/services?limit=1000")
      .set("Accept-Encoding", "gzip");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["content-encoding"], undefined);
  });

  void it("preserves service ETag revalidation and 304 responses", async () => {
    configureCompression();
    servicesStore.set("svc-etag-compression", { priceStroops: 25 });

    const app = createApp();
    const first = await request(app)
      .get("/api/v1/services")
      .set("Accept-Encoding", "gzip");
    const etag = first.headers.etag as string;
    assert.strictEqual(first.status, 200);
    assert.ok(etag, "ETag header missing");

    const second = await request(app)
      .get("/api/v1/services")
      .set("Accept-Encoding", "gzip")
      .set("If-None-Match", etag);

    assert.strictEqual(second.status, 304);
    assert.strictEqual(second.headers["content-encoding"], undefined);
  });

  void it("keeps Prometheus metrics exposition uncompressed", async () => {
    configureCompression(1);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/metrics")
      .set("Accept-Encoding", "gzip");

    assert.strictEqual(res.status, 200);
    const contentType = res.headers["content-type"];
    assert.ok(contentType.includes("text/plain"));
    assert.ok(contentType.includes("version=0.0.4"));
    assert.strictEqual(res.headers["content-encoding"], undefined);
  });

  void it("compresses CSV exports without losing download headers", async () => {
    configureCompression();
    for (let i = 0; i < 50; i++) {
      usageStore.set(usageKey(`agent-${i}`, "svc-export"), i + 1);
    }

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/usage/export.csv")
      .set("Accept-Encoding", "gzip");

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers["content-encoding"], "gzip");
    assert.match(res.headers["content-disposition"], /filename=usage\.csv/);
  });
});
