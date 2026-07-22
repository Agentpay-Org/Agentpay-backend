import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { servicesStore, usageKey, usageStore } from "./store/state.js";

beforeEach(() => {
  servicesStore.clear();
  usageStore.clear();
});

void describe("billing and settlement for unknown services", () => {
  void it("returns 404 for unknown service billing instead of pricing at zero", async () => {
    const app = createApp();
    usageStore.set(usageKey("agent-unknown-bill", "svc-missing"), 8);

    const res = await request(app).get(
      "/api/v1/billing/agent-unknown-bill/svc-missing"
    );

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, "not_found");
    const message: unknown = res.body.message;
    if (typeof message !== "string") throw new Error("expected string message");
    assert.match(message, /svc-missing/);
    assert.ok(res.body.requestId);
    assert.strictEqual(res.body.billedStroops, undefined);
  });

  void it("settles an unknown service at a zero price and drains its usage", async () => {
    const app = createApp();
    const key = usageKey("agent-unknown-settle", "svc-missing");
    usageStore.set(key, 13);

    const res = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-unknown-settle", serviceId: "svc-missing" });

    // Settlement mirrors POST /api/v1/settle/bulk: unregistered services price
    // at zero and drain, rather than 404-ing and stranding the counter.
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.priceStroops, 0);
    assert.strictEqual(res.body.billedStroops, 0);
    assert.strictEqual(usageStore.get(key), 0);
  });

  void it("keeps registered zero-price service billing and settlement successful", async () => {
    const app = createApp();
    const key = usageKey("agent-free", "svc-free");
    servicesStore.set("svc-free", { priceStroops: 0 });
    usageStore.set(key, 5);

    const quote = await request(app).get("/api/v1/billing/agent-free/svc-free");

    assert.strictEqual(quote.status, 200);
    assert.deepStrictEqual(quote.body, {
      agent: "agent-free",
      serviceId: "svc-free",
      requests: 5,
      priceStroops: 0,
      billedStroops: 0,
    });

    const settle = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "agent-free", serviceId: "svc-free" });

    assert.strictEqual(settle.status, 200);
    assert.deepStrictEqual(settle.body, {
      agent: "agent-free",
      serviceId: "svc-free",
      requests: 5,
      priceStroops: 0,
      billedStroops: 0,
    });
    assert.strictEqual(usageStore.get(key), 0);
  });
});
