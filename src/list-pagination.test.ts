import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

const uniq = (prefix: string) => `${prefix}-${Date.now()}-${Math.random()}`;
const tick = () => new Promise((resolve) => setTimeout(resolve, 2));

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

function currentListCount(body: unknown): number {
  const parsed = objectBody(body);
  if (typeof parsed.total === "number") return parsed.total;
  assert.ok(Array.isArray(parsed.items));
  return parsed.items.length;
}

async function apiKeyCount() {
  const res = await request(app).get("/api/v1/api-keys");
  assert.strictEqual(res.status, 200);
  return currentListCount(res.body as unknown);
}

async function webhookCount() {
  const res = await request(app).get("/api/v1/webhooks");
  assert.strictEqual(res.status, 200);
  return currentListCount(res.body as unknown);
}

void describe("list endpoint pagination", () => {
  void it("paginates api keys with total count and prefix-only items", async () => {
    const beforeTotal = await apiKeyCount();
    await tick();

    const labels = [uniq("key-a"), uniq("key-b"), uniq("key-c")];
    for (const label of labels) {
      const created = await request(app).post("/api/v1/api-keys").send({ label });
      assert.strictEqual(created.status, 201);
      assert.ok(created.body.key, "created response should include the one-time key");
    }

    const firstPage = await request(app).get(
      `/api/v1/api-keys?limit=2&offset=${beforeTotal}`
    );
    const secondPage = await request(app).get(
      `/api/v1/api-keys?limit=2&offset=${beforeTotal + 2}`
    );
    const repeatedFirstPage = await request(app).get(
      `/api/v1/api-keys?limit=2&offset=${beforeTotal}`
    );

    assert.strictEqual(firstPage.status, 200);
    assert.strictEqual(secondPage.status, 200);
    const first = listBody(firstPage.body as unknown);
    const second = listBody(secondPage.body as unknown);
    const repeatedFirst = listBody(repeatedFirstPage.body as unknown);
    assert.strictEqual(first.total, beforeTotal + labels.length);
    assert.strictEqual(second.total, beforeTotal + labels.length);
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
      `/api/v1/api-keys?limit=2&offset=${beforeTotal + labels.length}`
    );
    assert.strictEqual(pastEnd.status, 200);
    const empty = listBody(pastEnd.body as unknown);
    assert.deepStrictEqual(empty.items, []);
    assert.strictEqual(empty.total, beforeTotal + labels.length);
  });

  void it("paginates webhooks with total count and stable item shape", async () => {
    const beforeTotal = await webhookCount();
    await tick();

    const urls = [
      `https://example.com/${uniq("hook-a")}`,
      `https://example.com/${uniq("hook-b")}`,
      `https://example.com/${uniq("hook-c")}`,
    ];
    for (const url of urls) {
      const created = await request(app)
        .post("/api/v1/webhooks")
        .send({ url, events: ["usage.recorded"] });
      assert.strictEqual(created.status, 201);
    }

    const firstPage = await request(app).get(
      `/api/v1/webhooks?limit=2&offset=${beforeTotal}`
    );
    const secondPage = await request(app).get(
      `/api/v1/webhooks?limit=2&offset=${beforeTotal + 2}`
    );
    const repeatedFirstPage = await request(app).get(
      `/api/v1/webhooks?limit=2&offset=${beforeTotal}`
    );

    assert.strictEqual(firstPage.status, 200);
    assert.strictEqual(secondPage.status, 200);
    const first = listBody(firstPage.body as unknown);
    const second = listBody(secondPage.body as unknown);
    const repeatedFirst = listBody(repeatedFirstPage.body as unknown);
    assert.strictEqual(first.total, beforeTotal + urls.length);
    assert.strictEqual(second.total, beforeTotal + urls.length);
    assert.strictEqual(first.items.length, 2);
    assert.strictEqual(second.items.length, 1);
    assert.deepStrictEqual(first.items, repeatedFirst.items);

    const listed = [...first.items, ...second.items].map(webhookItem);
    assert.deepStrictEqual(new Set(listed.map((item) => item.url)), new Set(urls));
    for (const item of listed) {
      assert.ok(item.id.startsWith("wh_"));
      assert.deepStrictEqual(item.events, ["usage.recorded"]);
      assert.strictEqual(typeof item.createdAt, "number");
    }

    const pastEnd = await request(app).get(
      `/api/v1/webhooks?limit=2&offset=${beforeTotal + urls.length}`
    );
    assert.strictEqual(pastEnd.status, 200);
    const empty = listBody(pastEnd.body as unknown);
    assert.deepStrictEqual(empty.items, []);
    assert.strictEqual(empty.total, beforeTotal + urls.length);
  });
});
