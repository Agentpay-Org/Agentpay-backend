import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { apiKeyStore } from "./store/state.js";

beforeEach(() => {
  apiKeyStore.clear();
});

void describe("api-keys endpoint", () => {
  void it("creates, lists (with cursor pagination), and revokes a key", async () => {
    const app = createApp();

    const created = await request(app).post("/api/v1/api-keys").send({ label: "key-a" });
    assert.strictEqual(created.status, 201);
    await request(app).post("/api/v1/api-keys").send({ label: "key-b" });

    const firstPage = await request(app).get("/api/v1/api-keys?limit=1");
    assert.strictEqual(firstPage.status, 200);
    assert.strictEqual(firstPage.body.items.length, 1);
    assert.strictEqual(firstPage.body.total, 2);
    assert.ok(firstPage.body.nextCursor);

    const secondPage = await request(app).get(
      `/api/v1/api-keys?limit=1&cursor=${firstPage.body.nextCursor}`
    );
    assert.strictEqual(secondPage.status, 200);
    assert.strictEqual(secondPage.body.items.length, 1);
    assert.strictEqual(secondPage.body.nextCursor, null);
    assert.notStrictEqual(secondPage.body.items[0].prefix, firstPage.body.items[0].prefix);

    const prefix = String(created.body.key).slice(0, 8);
    const revoked = await request(app).delete(`/api/v1/api-keys/${prefix}`);
    assert.strictEqual(revoked.status, 204);

    const revokedAgain = await request(app).delete(`/api/v1/api-keys/${prefix}`);
    assert.strictEqual(revokedAgain.status, 404);
    assert.strictEqual(revokedAgain.body.error, "not_found");
  });

  void it("rejects a blank label with 400", async () => {
    const res = await request(createApp()).post("/api/v1/api-keys").send({ label: "   " });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
  });

  void it("rejects an unexpected body field with 400", async () => {
    const res = await request(createApp())
      .post("/api/v1/api-keys")
      .send({ label: "ok", extra: true });
    assert.strictEqual(res.status, 400);
    assert.match(String(res.body.message), /unexpected field: extra/);
  });

  void it("rejects a malformed delete prefix with 400, not a 404", async () => {
    const res = await request(createApp()).delete("/api/v1/api-keys/not a valid prefix!");
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
  });

  void it("rejects a malformed list cursor with 400", async () => {
    const res = await request(createApp()).get("/api/v1/api-keys?cursor=not-a-cursor!!");
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
  });

  void it("rejects an unknown query parameter with 400", async () => {
    const res = await request(createApp()).get("/api/v1/api-keys?bogus=1");
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.error, "invalid_request");
  });

  void it("repeats identically for the same query (idempotent)", async () => {
    await request(createApp()).post("/api/v1/api-keys").send({ label: "idem" });
    const app = createApp();
    const first = await request(app).get("/api/v1/api-keys");
    const second = await request(app).get("/api/v1/api-keys");
    assert.deepStrictEqual(first.body, second.body);
  });
});
