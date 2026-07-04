import { describe, it } from "node:test";
import assert from "node:assert";
import request, { type Response } from "supertest";
import { app } from "./index.js";

function assertSecurityHeaders(res: Response): void {
  assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
  assert.strictEqual(res.headers["x-frame-options"], "DENY");
  assert.strictEqual(res.headers["referrer-policy"], "no-referrer");
  assert.strictEqual(
    res.headers["strict-transport-security"],
    "max-age=63072000; includeSubDomains; preload"
  );
  assert.strictEqual(
    res.headers["permissions-policy"],
    "geolocation=(), camera=(), microphone=()"
  );

  const csp = res.headers["content-security-policy"];
  assert.ok(csp, "Content-Security-Policy header missing");
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /script-src 'none'/);
  assert.doesNotMatch(csp, /'unsafe-inline'/);
  assert.doesNotMatch(csp, /'unsafe-eval'/);
}

void describe("Helmet security headers", () => {
  void it("adds hardened security headers to JSON API responses", async () => {
    const res = await request(app).get("/api/v1/stats");

    assert.strictEqual(res.status, 200);
    assert.match(res.headers["content-type"], /application\/json/);
    assertSecurityHeaders(res);
  });

  void it("keeps hardened headers on CSV and JSON download responses", async () => {
    const csv = await request(app).get("/api/v1/usage/export.csv");
    assert.strictEqual(csv.status, 200);
    assert.match(csv.headers["content-type"], /text\/csv/);
    assert.strictEqual(
      csv.headers["content-disposition"],
      "attachment; filename=usage.csv"
    );
    assert.match(csv.text, /^agent,serviceId,total\n/);
    assertSecurityHeaders(csv);

    const json = await request(app).get("/api/v1/usage/export.json");
    assert.strictEqual(json.status, 200);
    assert.match(json.headers["content-type"], /application\/json/);
    assert.strictEqual(
      json.headers["content-disposition"],
      "attachment; filename=usage.json"
    );
    assertSecurityHeaders(json);
  });

  void it("does not interfere with Prometheus metrics exposition", async () => {
    const res = await request(app).get("/api/v1/metrics");

    assert.strictEqual(res.status, 200);
    assert.match(res.headers["content-type"], /text\/plain/);
    assert.match(res.text, /# HELP agentpay_services_total/);
    assertSecurityHeaders(res);
  });
});
