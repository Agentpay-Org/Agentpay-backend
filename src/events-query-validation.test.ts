import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

void describe("events query validation", () => {
  void it("rejects an unknown query parameter on /api/v1/events with 400", async () => {
    const res = await request(app).get("/api/v1/events?bogus=1");
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
    assert.ok(res.body.requestId);
  });

  void it("rejects an unknown query parameter on /api/v1/events/summary with 400", async () => {
    const res = await request(app).get("/api/v1/events/summary?bogus=1");
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
  });

  void it("still accepts the documented since/type/limit/cursor parameters", async () => {
    const res = await request(app).get(
      "/api/v1/events?since=0&type=usage.recorded&limit=5"
    );
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.items));
  });
});
