import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { eventLog } from "./events.js";
import { createApp } from "./index.js";
import {
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageKey,
  usageStore,
} from "./store/state.js";

beforeEach(() => {
  eventLog.length = 0;
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
});

void describe("service deletion cleanup", () => {
  void it("clears metadata and disabled state when deleting a service", async () => {
    const app = createApp();
    servicesStore.set("svc-delete", { priceStroops: 10 });
    servicesMetadata.set("svc-delete", {
      description: "previous owner metadata",
      owner: "alice",
    });
    servicesDisabled.add("svc-delete");

    const deleted = await request(app).delete("/api/v1/services/svc-delete");

    assert.strictEqual(deleted.status, 204);
    assert.strictEqual(servicesStore.has("svc-delete"), false);
    assert.strictEqual(servicesMetadata.has("svc-delete"), false);
    assert.strictEqual(servicesDisabled.has("svc-delete"), false);
  });

  void it("returns 404 on GET after a successful delete", async () => {
    const app = createApp();
    servicesStore.set("svc-get-after", { priceStroops: 5 });

    await request(app).delete("/api/v1/services/svc-get-after").expect(204);

    const res = await request(app).get("/api/v1/services/svc-get-after");
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, "not_found");
  });

  void it("returns 404 on GET metadata after a successful delete", async () => {
    const app = createApp();
    servicesStore.set("svc-meta-gone", { priceStroops: 5 });
    servicesMetadata.set("svc-meta-gone", {
      description: "about to vanish",
      owner: "bob",
    });

    await request(app).delete("/api/v1/services/svc-meta-gone").expect(204);

    const res = await request(app).get("/api/v1/services/svc-meta-gone/metadata");
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, "not_found");
  });

  void it("lets a re-registered service start clean after deletion", async () => {
    const app = createApp();
    servicesStore.set("svc-reregister", { priceStroops: 10 });
    servicesMetadata.set("svc-reregister", {
      description: "stale metadata",
      owner: "old-owner",
    });
    servicesDisabled.add("svc-reregister");

    await request(app).delete("/api/v1/services/svc-reregister").expect(204);
    await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-reregister", priceStroops: 15 })
      .expect(201);

    // Re-registered service should have no inherited metadata
    const metadata = await request(app).get("/api/v1/services/svc-reregister/metadata");
    assert.strictEqual(metadata.status, 404);

    // Re-registered service should not be disabled
    const detail = await request(app).get("/api/v1/services/svc-reregister");
    assert.strictEqual(detail.status, 200);
    assert.strictEqual(detail.body.disabled, false);
    assert.strictEqual(detail.body.priceStroops, 15);

    // Usage recording should work normally
    const usage = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-clean", serviceId: "svc-reregister", requests: 1 });
    assert.strictEqual(usage.status, 201);
  });

  void it("records a service.deleted audit event on successful deletion", async () => {
    const app = createApp();
    servicesStore.set("svc-audit", { priceStroops: 10 });

    const deleted = await request(app).delete("/api/v1/services/svc-audit");

    assert.strictEqual(deleted.status, 204);
    assert.strictEqual(eventLog.length, 1);
    assert.strictEqual(eventLog[0].type, "service.deleted");
    assert.deepStrictEqual(eventLog[0].payload, { serviceId: "svc-audit" });
    assert.ok(eventLog[0].id, "event should have a UUID id");
    assert.ok(typeof eventLog[0].ts === "number", "event should have a numeric timestamp");
  });

  void it("retains outstanding usage entries after deletion for billing", async () => {
    const app = createApp();
    servicesStore.set("svc-usage-kept", { priceStroops: 10 });
    usageStore.set(usageKey("agent-audit", "svc-usage-kept"), 7);

    const deleted = await request(app).delete("/api/v1/services/svc-usage-kept");

    assert.strictEqual(deleted.status, 204);
    assert.strictEqual(usageStore.get(usageKey("agent-audit", "svc-usage-kept")), 7);
  });

  void it("keeps the existing 404 behavior for unknown services", async () => {
    const app = createApp();

    const res = await request(app).delete("/api/v1/services/no-such-service");

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, "not_found");
    assert.ok(res.body.requestId);
    assert.strictEqual(eventLog.length, 0, "no audit event for failed delete");
  });

  void it("does not emit an audit event when deleting an already-deleted service", async () => {
    const app = createApp();
    servicesStore.set("svc-double-del", { priceStroops: 10 });

    await request(app).delete("/api/v1/services/svc-double-del").expect(204);
    assert.strictEqual(eventLog.length, 1);

    // Second delete should 404 with no new audit event
    await request(app).delete("/api/v1/services/svc-double-del").expect(404);
    assert.strictEqual(eventLog.length, 1, "second delete should not add an audit event");
  });

  void it("returns empty body on 204 after successful deletion", async () => {
    const app = createApp();
    servicesStore.set("svc-nobody", { priceStroops: 5 });

    const res = await request(app).delete("/api/v1/services/svc-nobody");
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.text, "");
  });
});
