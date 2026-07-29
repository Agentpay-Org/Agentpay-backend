import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";
import { apiKeyStore, webhookStore } from "./store/state.js";

const uniq = (prefix: string) => `${prefix}-${Date.now()}-${Math.random()}`;

type ApiKeyListItem = {
  prefix: string;
  key?: string;
  label: string;
};

type WebhookListItem = {
  id: string;
  url: string;
  events: string[];
  createdAt: number;
};

function objectBody(body: unknown): Record<string, unknown> {
  assert.ok(body !== null && typeof body === "object");
  return body as Record<string, unknown>;
}

function listBody(body: unknown): { items: unknown[]; total: number } {
  const parsed = objectBody(body);
  const items = parsed.items;
  const total = parsed.total;
  if (!Array.isArray(items)) assert.fail("items must be an array");
  if (typeof total !== "number") assert.fail("total must be a number");
  return { items, total };
}

function apiKeyItem(item: unknown): ApiKeyListItem {
  const parsed = objectBody(item);
  const { prefix, label, key } = parsed;
  if (typeof prefix !== "string") assert.fail("prefix must be a string");
  if (typeof label !== "string") assert.fail("label must be a string");
  if (key !== undefined && typeof key !== "string") {
    assert.fail("key must be absent or a string");
  }
  return { prefix, label, key };
}

function webhookItem(item: unknown): WebhookListItem {
  const parsed = objectBody(item);
  const { id, url, events, createdAt } = parsed;
  if (typeof id !== "string") assert.fail("id must be a string");
  if (typeof url !== "string") assert.fail("url must be a string");
  if (typeof createdAt !== "number") assert.fail("createdAt must be a number");
  assert.ok(
    Array.isArray(events) && events.every((event) => typeof event === "string")
  );
  return { id, url, events, createdAt };
}

beforeEach(() => {
  apiKeyStore.clear();
  webhookStore.clear();
});

void describe("list endpoint pagination", () => {
  void it("paginates api keys with total count and prefix-only items", async () => {
    const labels = [uniq("key-a"), uniq("key-b"), uniq("key-c")];
    for (const label of labels) {
      const created = await request(app).post("/api/v1/api-keys").send({ label });
      assert.strictEqual(created.status, 201);
      assert.ok(created.body.key, "created response should include the one-time key");
    }

    const firstPage = await request(app).get("/api/v1/api-keys?limit=2&offset=0");
    const secondPage = await request(app).get("/api/v1/api-keys?limit=2&offset=2");
    const repeatedFirstPage = await request(app).get("/api/v1/api-keys?limit=2&offset=0");

    assert.strictEqual(firstPage.status, 200);
    assert.strictEqual(secondPage.status, 200);
    const first = listBody(firstPage.body as unknown);
    const second = listBody(secondPage.body as unknown);
    const repeatedFirst = listBody(repeatedFirstPage.body as unknown);
    assert.strictEqual(first.total, labels.length);
    assert.strictEqual(second.total, labels.length);
    assert.strictEqual(first.items.length, 2);
    assert.strictEqual(second.items.length, 1);
    assert.deepStrictEqual(first.items, repeatedFirst.items);

    const listed = [...first.items, ...second.items].map(apiKeyItem);
    assert.deepStrictEqual(new Set(listed.map((item) => item.label)), new Set(labels));
    for (const item of listed) {
      assert.strictEqual(item.key, undefined);
      assert.strictEqual(typeof item.prefix, "string");
      assert.strictEqual(item.prefix.length, 8);
    }

    const pastEnd = await request(app).get(
      `/api/v1/api-keys?limit=2&offset=${labels.length}`
    );
    assert.strictEqual(pastEnd.status, 200);
    const empty = listBody(pastEnd.body as unknown);
    assert.deepStrictEqual(empty.items, []);
    assert.strictEqual(empty.total, labels.length);
  });

  void it("paginates webhooks with cursor-based pages and stable item shape", async () => {
    const urls = [
      `https://example.com/${uniq("hook-a")}`,
      `https://example.com/${uniq("hook-b")}`,
      `https://example.com/${uniq("hook-c")}`,
    ];
    for (const [index, url] of urls.entries()) {
      webhookStore.set(`wh_seed_${index}`, {
        url,
        events: ["usage.recorded"],
        createdAt: 1_700_000_000_000 + index,
      });
    }

    const firstPage = await request(app).get("/api/v1/webhooks?limit=2");
    const secondPage = await request(app)
      .get("/api/v1/webhooks")
      .query({ limit: 2, cursor: firstPage.body.nextCursor });

    assert.strictEqual(firstPage.status, 200);
    assert.strictEqual(secondPage.status, 200);
    const first = listBody(firstPage.body as unknown);
    const second = listBody(secondPage.body as unknown);
    assert.strictEqual(first.total, 3);
    assert.strictEqual(second.total, 3);
    assert.strictEqual(first.items.length, 2);
    assert.strictEqual(second.items.length, 1);
    assert.strictEqual(typeof firstPage.body.nextCursor, "string");
    assert.strictEqual(secondPage.body.nextCursor, null);

    const listed = [...first.items, ...second.items].map(webhookItem);
    assert.deepStrictEqual(new Set(listed.map((item) => item.url)), new Set(urls));
    for (const item of listed) {
      assert.ok(item.id.startsWith("wh_seed_"));
      assert.deepStrictEqual(item.events, ["usage.recorded"]);
      assert.strictEqual(typeof item.createdAt, "number");
    }
  });

  void it("returns a null cursor on exact page boundaries", async () => {
    webhookStore.set("wh_exact_1", {
      url: "https://example.com/exact-1",
      events: ["usage.recorded"],
      createdAt: 1_700_000_000_100,
    });
    webhookStore.set("wh_exact_2", {
      url: "https://example.com/exact-2",
      events: ["usage.recorded"],
      createdAt: 1_700_000_000_101,
    });

    const response = await request(app).get("/api/v1/webhooks?limit=2");
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.items.length, 2);
    assert.strictEqual(response.body.total, 2);
    assert.strictEqual(response.body.nextCursor, null);
  });

  void it("clamps over-large webhook page sizes", async () => {
    for (let index = 0; index < 501; index += 1) {
      webhookStore.set(`wh_bulk_${index}`, {
        url: `https://example.com/bulk-${index}`,
        events: ["usage.recorded"],
        createdAt: 1_700_000_100_000 + index,
      });
    }

    const firstPage = await request(app).get("/api/v1/webhooks?limit=9999");
    const secondPage = await request(app)
      .get("/api/v1/webhooks")
      .query({ limit: 9999, cursor: firstPage.body.nextCursor });

    assert.strictEqual(firstPage.status, 200);
    assert.strictEqual(firstPage.body.items.length, 500);
    assert.strictEqual(firstPage.body.total, 501);
    assert.strictEqual(typeof firstPage.body.nextCursor, "string");
    assert.strictEqual(secondPage.status, 200);
    assert.strictEqual(secondPage.body.items.length, 1);
    assert.strictEqual(secondPage.body.nextCursor, null);
  });

  void it("rejects malformed webhook cursors", async () => {
    webhookStore.set("wh_cursor_1", {
      url: "https://example.com/cursor",
      events: ["usage.recorded"],
      createdAt: 1_700_000_200_000,
    });

    const response = await request(app).get("/api/v1/webhooks?cursor=not-a-valid-cursor");
    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error, "invalid_request");
    assert.ok(String(response.body.message).includes("cursor"));
  });
});
