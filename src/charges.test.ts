import assert from "node:assert/strict";
import express, { type Request } from "express";
import request from "supertest";
import { describe, it } from "node:test";
import {
  chargeFingerprint,
  CHARGE_KEY_TTL_MS,
  InMemoryChargeIdempotencyStore,
  InMemoryChargeStore,
  validateChargeInput,
  validateIdempotencyKey,
} from "./charges.js";
import { createChargesRouter } from "./routes/charges.js";

const body = { amount: 1200, currency: "USD", source: "acct_123", description: "usage" };

function appWithStores() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const key = req.header("x-api-key");
    if (key) (req as Request & { apiKeyHash?: string }).apiKeyHash = key;
    next();
  });
  const idempotencyStore = new InMemoryChargeIdempotencyStore();
  const chargeStore = new InMemoryChargeStore();
  app.use(createChargesRouter({ idempotencyStore, chargeStore }));
  return { app, idempotencyStore, chargeStore };
}

void describe("charge validation and fingerprinting", () => {
  void it("accepts the supported charge shape", () => {
    assert.deepEqual(validateChargeInput(body), { ok: true, value: body });
  });

  void it("rejects unsafe amount, currency, source, and description values", () => {
    for (const invalid of [
      { ...body, amount: 0 },
      { ...body, amount: 1.5 },
      { ...body, amount: Number.MAX_SAFE_INTEGER + 1 },
      { ...body, currency: "usd" },
      { ...body, currency: "US" },
      { ...body, source: "" },
      { ...body, description: "x".repeat(501) },
    ]) {
      assert.equal(validateChargeInput(invalid).ok, false);
    }
  });

  void it("canonicalizes a semantically identical payload", () => {
    assert.equal(
      chargeFingerprint("tenant", "post", "/api/v1/charges", body),
      chargeFingerprint("tenant", "POST", "/api/v1/charges", { ...body })
    );
    assert.notEqual(
      chargeFingerprint("other-tenant", "POST", "/api/v1/charges", body),
      chargeFingerprint("tenant", "POST", "/api/v1/charges", body)
    );
  });

  void it("accepts safe keys and rejects malformed or oversized keys", () => {
    assert.equal(validateIdempotencyKey("order:123~retry"), "order:123~retry");
    assert.equal(validateIdempotencyKey(" "), undefined);
    assert.equal(validateIdempotencyKey("bad key"), undefined);
    assert.equal(validateIdempotencyKey("x".repeat(256)), undefined);
  });
});

void describe("charge idempotency store", () => {
  void it("atomically claims once, then reports in-progress", () => {
    const store = new InMemoryChargeIdempotencyStore();
    const first = store.claim("tenant", "key", "fp", 100);
    const second = store.claim("tenant", "key", "fp", 101);
    assert.equal(first.kind, "claimed");
    assert.equal(second.kind, "in_progress");
  });

  void it("distinguishes conflicting payloads", () => {
    const store = new InMemoryChargeIdempotencyStore();
    store.claim("tenant", "key", "one", 100);
    assert.equal(store.claim("tenant", "key", "two", 101).kind, "conflict");
  });

  void it("returns a cloned completed response", () => {
    const store = new InMemoryChargeIdempotencyStore();
    const claim = store.claim("tenant", "key", "fp", 100);
    assert.equal(claim.kind, "claimed");
    if (claim.kind !== "claimed") return;
    store.complete(claim.record, { statusCode: 201, body: { id: "charge" } }, 200);
    const replay = store.claim("tenant", "key", "fp", 201);
    assert.equal(replay.kind, "replay");
    if (replay.kind === "replay") {
      assert.deepEqual(replay.response.body, { id: "charge" });
      assert.notEqual(replay.response.body, claim.record.response?.body);
    }
  });

  void it("expires completed keys after twenty-four hours", () => {
    const store = new InMemoryChargeIdempotencyStore();
    const claim = store.claim("tenant", "key", "fp", 100);
    assert.equal(claim.kind, "claimed");
    if (claim.kind !== "claimed") return;
    store.complete(claim.record, { statusCode: 201, body: {} }, 100);
    assert.equal(store.prune(100 + CHARGE_KEY_TTL_MS), 1);
    assert.equal(store.size(), 0);
    assert.equal(store.claim("tenant", "key", "new", 101 + CHARGE_KEY_TTL_MS).kind, "claimed");
  });

  void it("isolates the same key across tenants", () => {
    const store = new InMemoryChargeIdempotencyStore();
    assert.equal(store.claim("a", "same", "fp", 1).kind, "claimed");
    assert.equal(store.claim("b", "same", "fp", 1).kind, "claimed");
  });

  void it("releases a failed claim for a safe retry", () => {
    const store = new InMemoryChargeIdempotencyStore();
    const claim = store.claim("tenant", "key", "fp", 1);
    assert.equal(claim.kind, "claimed");
    if (claim.kind !== "claimed") return;
    store.release(claim.record);
    assert.equal(store.claim("tenant", "key", "fp", 2).kind, "claimed");
  });
});

void describe("POST /api/v1/charges", () => {
  void it("creates once and replays the exact stored response", async () => {
    const { app, chargeStore } = appWithStores();
    const first = await request(app).post("/api/v1/charges").set("Idempotency-Key", "k-1").send(body);
    const second = await request(app).post("/api/v1/charges").set("Idempotency-Key", "k-1").send(body);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(second.headers["idempotency-replayed"], "true");
    assert.deepEqual(second.body, first.body);
    assert.equal(chargeStore.count(), 1);
  });

  void it("rejects a same-key payload conflict without a second charge", async () => {
    const { app, chargeStore } = appWithStores();
    await request(app).post("/api/v1/charges").set("Idempotency-Key", "k-2").send(body);
    const conflict = await request(app).post("/api/v1/charges").set("Idempotency-Key", "k-2").send({ ...body, amount: 1300 });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.error, "idempotency_conflict");
    assert.equal(chargeStore.count(), 1);
  });

  void it("rejects concurrent claims before a second side effect can run", async () => {
    const { app, idempotencyStore, chargeStore } = appWithStores();
    const claim = idempotencyStore.claim(
      "public",
      "busy",
      chargeFingerprint("public", "POST", "/api/v1/charges", body),
      Date.now()
    );
    assert.equal(claim.kind, "claimed");
    const response = await request(app).post("/api/v1/charges").set("Idempotency-Key", "busy").send(body);
    assert.equal(response.status, 409);
    assert.equal(response.body.error, "request_in_progress");
    assert.equal(chargeStore.count(), 0);
  });

  void it("preserves behavior without a key", async () => {
    const { app, chargeStore } = appWithStores();
    const first = await request(app).post("/api/v1/charges").send(body);
    const second = await request(app).post("/api/v1/charges").send(body);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(first.body.charge.id, second.body.charge.id);
    assert.equal(chargeStore.count(), 2);
  });

  void it("rejects malformed keys and bodies before claiming", async () => {
    const { app, idempotencyStore } = appWithStores();
    const malformedKey = await request(app).post("/api/v1/charges").set("Idempotency-Key", "not safe").send(body);
    const malformedBody = await request(app).post("/api/v1/charges").set("Idempotency-Key", "valid").send({ ...body, amount: 0 });
    assert.equal(malformedKey.status, 400);
    assert.equal(malformedBody.status, 400);
    assert.equal(idempotencyStore.size(), 0);
  });

  void it("scopes keys by the API-key-derived tenant", async () => {
    const { app, chargeStore } = appWithStores();
    const first = await request(app).post("/api/v1/charges").set("X-API-Key", "tenant-a").set("Idempotency-Key", "shared").send(body);
    const second = await request(app).post("/api/v1/charges").set("X-API-Key", "tenant-b").set("Idempotency-Key", "shared").send(body);
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(chargeStore.count(), 2);
  });

  void it("lists charges only for the current tenant", async () => {
    const { app } = appWithStores();
    await request(app).post("/api/v1/charges").set("X-API-Key", "tenant-a").send(body);
    await request(app).post("/api/v1/charges").set("X-API-Key", "tenant-b").send(body);
    const result = await request(app).get("/api/v1/charges").set("X-API-Key", "tenant-a");
    assert.equal(result.status, 200);
    assert.equal(result.body.charges.length, 1);
  });
});
