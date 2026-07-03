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

    const metadata = await request(app).get("/api/v1/services/svc-reregister/metadata");
    assert.strictEqual(metadata.status, 404);

    const usage = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-clean", serviceId: "svc-reregister", requests: 1 });
    assert.strictEqual(usage.status, 201);
  });

  void it("records a service.deleted event while retaining outstanding usage", async () => {
    const app = createApp();
    servicesStore.set("svc-audit", { priceStroops: 10 });
    usageStore.set(usageKey("agent-audit", "svc-audit"), 7);

    const deleted = await request(app).delete("/api/v1/services/svc-audit");

    assert.strictEqual(deleted.status, 204);
    assert.strictEqual(usageStore.get(usageKey("agent-audit", "svc-audit")), 7);
    assert.strictEqual(eventLog.length, 1);
    assert.strictEqual(eventLog[0].type, "service.deleted");
    assert.deepStrictEqual(eventLog[0].payload, { serviceId: "svc-audit" });
  });

  void it("keeps the existing 404 behavior for unknown services", async () => {
    const app = createApp();

    const res = await request(app).delete("/api/v1/services/no-such-service");

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.error, "not_found");
    assert.ok(res.body.requestId);
    assert.strictEqual(eventLog.length, 0);
  });
});
