import { describe, it } from "node:test";
import assert from "node:assert";
import request, { type Response } from "supertest";
import { app } from "./index.js";

const EXPECTED_PERMISSIONS_POLICY = "geolocation=(), camera=(), microphone=()";
const EXPECTED_HSTS = "max-age=63072000; includeSubDomains; preload";

function parseCsp(header: string) {
  const directives = new Map<string, string[]>();
  for (const part of header.split(";")) {
    const [name, ...values] = part.trim().split(/\s+/);
    if (name) directives.set(name, values);
  }
  return directives;
}

function assertApiSecurityHeaders(res: Response) {
  assert.strictEqual(res.headers["x-content-type-options"], "nosniff");
  assert.strictEqual(res.headers["x-frame-options"], "DENY");
  assert.strictEqual(res.headers["strict-transport-security"], EXPECTED_HSTS);
  assert.strictEqual(res.headers["referrer-policy"], "no-referrer");
  assert.strictEqual(res.headers["permissions-policy"], EXPECTED_PERMISSIONS_POLICY);

  const cspHeader = res.headers["content-security-policy"];
  assert.strictEqual(typeof cspHeader, "string");
  assert.ok(!cspHeader.includes("'unsafe-inline'"));
  assert.ok(!cspHeader.includes("'unsafe-eval'"));

  const csp = parseCsp(cspHeader);
  for (const directive of [
    "default-src",
    "base-uri",
    "connect-src",
    "font-src",
    "form-action",
    "frame-ancestors",
    "img-src",
    "manifest-src",
    "media-src",
    "object-src",
    "script-src",
    "style-src",
    "worker-src",
  ]) {
    assert.deepStrictEqual(csp.get(directive), ["'none'"], `${directive} mismatch`);
  }
}

void describe("Security headers", () => {
  void it("sets Helmet headers and tuned CSP on JSON responses", async () => {
    const res = await request(app).get("/health");
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers["content-type"].startsWith("application/json"));
    assertApiSecurityHeaders(res);
  });

  void it("keeps CSV downloads usable with Helmet headers", async () => {
    const res = await request(app).get("/api/v1/usage/export.csv");
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers["content-type"].startsWith("text/csv"));
    assert.strictEqual(
      res.headers["content-disposition"],
      "attachment; filename=usage.csv"
    );
    assert.ok(res.text.startsWith("agent,serviceId,total\n"));
    assertApiSecurityHeaders(res);
  });

  void it("keeps Prometheus metrics text exposition usable with Helmet headers", async () => {
    const res = await request(app).get("/api/v1/metrics");
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers["content-type"].startsWith("text/plain"));
    assert.ok(res.text.includes("# HELP agentpay_services_total"));
    assertApiSecurityHeaders(res);
  });
});
