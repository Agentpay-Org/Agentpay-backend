import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { eventLog, recordEvent } from "./events.js";
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

function seedEvents(): void {
  for (const label of ["a", "b", "c", "d", "e"]) {
    recordEvent(label === "c" ? "billing.quoted" : "usage.recorded", { label });
  }
}

void describe("event log cursor pagination", () => {
  void it("returns total and a cursor for the latest page", async () => {
    seedEvents();
    const app = createApp();

    const firstPage = await request(app).get("/api/v1/events?limit=2");

    assert.strictEqual(firstPage.status, 200);
    assert.strictEqual(firstPage.body.total, 5);
    assert.deepStrictEqual(
      firstPage.body.items.map(
        (event: { payload: { label: string } }) => event.payload.label
      ),
      ["d", "e"]
    );
    assert.strictEqual(typeof firstPage.body.nextCursor, "string");
  });

  void it("uses nextCursor to page backward through older events", async () => {
    seedEvents();
    const app = createApp();

    const firstPage = await request(app).get("/api/v1/events?limit=2");
    const secondPage = await request(app)
      .get("/api/v1/events")
      .query({ limit: 2, cursor: firstPage.body.nextCursor });
    const thirdPage = await request(app)
      .get("/api/v1/events")
      .query({ limit: 2, cursor: secondPage.body.nextCursor });

    assert.strictEqual(secondPage.status, 200);
    assert.deepStrictEqual(
      secondPage.body.items.map(
        (event: { payload: { label: string } }) => event.payload.label
      ),
      ["b", "c"]
    );
    assert.strictEqual(secondPage.body.total, 5);
    assert.strictEqual(typeof secondPage.body.nextCursor, "string");

    assert.strictEqual(thirdPage.status, 200);
    assert.deepStrictEqual(
      thirdPage.body.items.map(
        (event: { payload: { label: string } }) => event.payload.label
      ),
      ["a"]
    );
    assert.strictEqual(thirdPage.body.nextCursor, null);
  });

  void it("combines type filters with cursor pagination and total counts", async () => {
    seedEvents();
    const app = createApp();

    const page = await request(app).get("/api/v1/events?type=usage.recorded&limit=2");
    const older = await request(app)
      .get("/api/v1/events")
      .query({ type: "usage.recorded", limit: 2, cursor: page.body.nextCursor });

    assert.strictEqual(page.status, 200);
    assert.strictEqual(page.body.total, 4);
    assert.deepStrictEqual(
      page.body.items.map(
        (event: { payload: { label: string } }) => event.payload.label
      ),
      ["d", "e"]
    );

    assert.strictEqual(older.status, 200);
    assert.strictEqual(older.body.total, 4);
    assert.deepStrictEqual(
      older.body.items.map(
        (event: { payload: { label: string } }) => event.payload.label
      ),
      ["a", "b"]
    );
    assert.strictEqual(older.body.nextCursor, null);
  });

  void it("rejects malformed or expired cursors with a standard 400 envelope", async () => {
    seedEvents();
    const app = createApp();

    const malformed = await request(app).get(
      "/api/v1/events?cursor=not-a-valid-cursor"
    );
    const expired = await request(app)
      .get("/api/v1/events")
      .query({
        cursor: Buffer.from("123:00000000-0000-0000-0000-000000000000").toString(
          "base64url"
        ),
      });

    assert.strictEqual(malformed.status, 400);
    assert.strictEqual(malformed.body.error, "invalid_request");
    assert.ok(malformed.body.requestId);

    assert.strictEqual(expired.status, 400);
    assert.strictEqual(expired.body.error, "invalid_request");
    assert.ok(expired.body.message.includes("cursor"));
  });
});
