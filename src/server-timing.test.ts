import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

function assertServerTimingHeader(value: string | undefined): void {
  assert.ok(value, "Server-Timing header missing");
  assert.match(value, /^app;dur=\d+(?:\.\d)?$/);
}

void describe("Server-Timing response header", () => {
  void it("is sent on JSON responses", async () => {
    const res = await request(app).get("/health");

    assert.strictEqual(res.status, 200);
    assertServerTimingHeader(res.headers["server-timing"]);
  });

  void it("is sent on CSV download responses", async () => {
    const res = await request(app).get("/api/v1/usage/export.csv");

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers["content-type"].startsWith("text/csv"));
    assertServerTimingHeader(res.headers["server-timing"]);
  });

  void it("is sent on Prometheus metrics responses", async () => {
    const res = await request(app).get("/api/v1/metrics");

    assert.strictEqual(res.status, 200);
    assert.ok(res.text.includes("agentpay_services_total"));
    assertServerTimingHeader(res.headers["server-timing"]);
  });

  void it("does not break empty 304 responses", async () => {
    const first = await request(app).get("/api/v1/services");
    const etag = first.headers.etag;

    assert.strictEqual(first.status, 200);
    assert.ok(etag, "ETag header missing");

    const second = await request(app)
      .get("/api/v1/services")
      .set("If-None-Match", etag);

    assert.strictEqual(second.status, 304);
    assert.strictEqual(second.text, "");
    assertServerTimingHeader(second.headers["server-timing"]);
  });
});
