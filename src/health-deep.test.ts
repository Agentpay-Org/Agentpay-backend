import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

const MAX_LIMIT_FOR_TEST = 50;

void describe("deep health checks", () => {
  void it("returns process diagnostics plus a bounded first page of checks", async () => {
    const res = await request(app).get("/api/v1/health/deep");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "ok");
    assert.strictEqual(typeof res.body.uptimeSeconds, "number");
    assert.strictEqual(typeof res.body.memory.rssMb, "number");
    assert.strictEqual(typeof res.body.checksTotal, "number");
    assert.ok(Array.isArray(res.body.checks));
    assert.ok(res.body.checks.length > 0);
    for (const check of res.body.checks) {
      assert.strictEqual(typeof check.name, "string");
      assert.ok(check.status === "ok" || check.status === "warn");
      assert.strictEqual(typeof check.detail, "object");
    }
  });

  void it("pages through checks with a stable nextChecksCursor", async () => {
    const firstPage = await request(app).get("/api/v1/health/deep?limit=1");
    assert.strictEqual(firstPage.status, 200);
    assert.strictEqual(firstPage.body.checks.length, 1);
    assert.ok(firstPage.body.nextChecksCursor);

    const secondPage = await request(app).get(
      `/api/v1/health/deep?limit=1&cursor=${firstPage.body.nextChecksCursor}`
    );
    assert.strictEqual(secondPage.status, 200);
    assert.strictEqual(secondPage.body.checks.length, 1);
    assert.notStrictEqual(secondPage.body.checks[0].name, firstPage.body.checks[0].name);

    const repeatFirstPage = await request(app).get("/api/v1/health/deep?limit=1");
    assert.strictEqual(repeatFirstPage.body.checks[0].name, firstPage.body.checks[0].name);
  });

  void it("returns the final page with a null nextChecksCursor", async () => {
    const res = await request(app).get(
      `/api/v1/health/deep?limit=${MAX_LIMIT_FOR_TEST}`
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.checksTotal, res.body.checks.length);
    assert.strictEqual(res.body.nextChecksCursor, null);
  });

  void it("rejects a malformed cursor with 400 invalid_request", async () => {
    const res = await request(app).get(
      "/api/v1/health/deep?cursor=not-a-real-cursor!!"
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.ok(res.body.requestId);
  });

  void it("rejects an unknown query parameter with 400 invalid_request", async () => {
    const deep = await request(app).get("/api/v1/health/deep?bogus=1");
    assert.strictEqual(deep.status, 400);
    assert.strictEqual(deep.body.error, "invalid_request");

    const ready = await request(app).get("/api/v1/health/ready?bogus=1");
    assert.strictEqual(ready.status, 400);
    assert.strictEqual(ready.body.error, "invalid_request");

    const shallow = await request(app).get("/health?bogus=1");
    assert.strictEqual(shallow.status, 400);
    assert.strictEqual(shallow.body.error, "invalid_request");
  });
});
