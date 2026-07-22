import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

const uniq = (prefix: string) => `${prefix}-${Date.now()}-${Math.random()}`;

void describe("events and stats conditional GET", () => {
  void it("returns an events ETag and 304 on an unchanged matching request", async () => {
    const first = await request(app).get("/api/v1/events?limit=5");
    assert.strictEqual(first.status, 200);
    assert.ok(first.headers.etag, "events ETag header missing");

    const second = await request(app)
      .get("/api/v1/events?limit=5")
      .set("If-None-Match", first.headers.etag as string);
    assert.strictEqual(second.status, 304);
    assert.strictEqual(second.text, "");
  });

  void it("changes the events ETag after a new event is recorded", async () => {
    const first = await request(app).get("/api/v1/events?type=usage.recorded&limit=5");
    assert.strictEqual(first.status, 200);
    const etag = first.headers.etag as string;
    assert.ok(etag, "events ETag header missing");

    await request(app)
      .post("/api/v1/usage")
      .send({
        agent: uniq("etag-agent"),
        serviceId: uniq("etag-service"),
        requests: 1,
      })
      .expect(201);

    const second = await request(app).get("/api/v1/events?type=usage.recorded&limit=5");
    assert.strictEqual(second.status, 200);
    assert.notStrictEqual(second.headers.etag, etag);
  });

  void it("uses query-specific events ETags even when filtered bodies match", async () => {
    const typeA = encodeURIComponent(uniq("never-a"));
    const typeB = encodeURIComponent(uniq("never-b"));

    const first = await request(app).get(`/api/v1/events?type=${typeA}`);
    const second = await request(app).get(`/api/v1/events?type=${typeB}`);

    assert.strictEqual(first.status, 200);
    assert.strictEqual(second.status, 200);
    assert.deepStrictEqual(first.body, { total: 0, items: [], nextCursor: null });
    assert.deepStrictEqual(second.body, { total: 0, items: [], nextCursor: null });
    assert.ok(first.headers.etag, "first filtered events ETag missing");
    assert.ok(second.headers.etag, "second filtered events ETag missing");
    assert.notStrictEqual(first.headers.etag, second.headers.etag);
  });

  void it("returns a stats ETag and 304 on unchanged stats", async () => {
    const first = await request(app).get("/api/v1/stats");
    assert.strictEqual(first.status, 200);
    assert.ok(first.headers.etag, "stats ETag header missing");

    const second = await request(app)
      .get("/api/v1/stats")
      .set("If-None-Match", first.headers.etag as string);

    assert.strictEqual(second.status, 304);
    assert.strictEqual(second.text, "");
  });
});
