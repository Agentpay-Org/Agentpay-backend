import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { eventLog } from "./events.js";
import { createApp } from "./index.js";
import {
  apiKeyStore,
  pauseState,
  rateBuckets,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageKey,
  usageStore,
  webhookStore,
} from "./store/state.js";

function resetState(): void {
  eventLog.length = 0;
  pauseState.paused = false;
  apiKeyStore.clear();
  rateBuckets.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
}

beforeEach(resetState);

void describe("service deletion cascade", () => {
  void it("clears metadata and disabled state, then re-registers cleanly", async () => {
    const app = createApp();

    const created = await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-cascade", priceStroops: 10 });
    assert.strictEqual(created.status, 201);

    const metadata = await request(app)
      .put("/api/v1/services/svc-cascade/metadata")
      .send({ description: "owned before delete", owner: "team-a" });
    assert.strictEqual(metadata.status, 200);

    const disabled = await request(app)
      .patch("/api/v1/services/svc-cascade/disabled")
      .send({ disabled: true });
    assert.strictEqual(disabled.status, 200);
    assert.strictEqual(disabled.body.disabled, true);

    const deleted = await request(app).delete("/api/v1/services/svc-cascade");
    assert.strictEqual(deleted.status, 204);
    assert.strictEqual(servicesStore.has("svc-cascade"), false);
    assert.strictEqual(servicesMetadata.has("svc-cascade"), false);
    assert.strictEqual(servicesDisabled.has("svc-cascade"), false);

    const staleMetadata = await request(app).get(
      "/api/v1/services/svc-cascade/metadata"
    );
    assert.strictEqual(staleMetadata.status, 404);

    const recreated = await request(app)
      .post("/api/v1/services")
      .send({ serviceId: "svc-cascade", priceStroops: 25 });
    assert.strictEqual(recreated.status, 201);

    const usage = await request(app)
      .post("/api/v1/usage")
      .send({ agent: "agent-after-delete", serviceId: "svc-cascade", requests: 2 });
    assert.strictEqual(usage.status, 201);
    assert.strictEqual(usage.body.total, 2);
  });

  void it("emits service.deleted and retains outstanding usage history", async () => {
    const app = createApp();
    servicesStore.set("svc-history", { priceStroops: 7 });
    usageStore.set(usageKey("agent-history", "svc-history"), 3);

    const deleted = await request(app).delete("/api/v1/services/svc-history");
    assert.strictEqual(deleted.status, 204);

    const usage = await request(app).get("/api/v1/usage/agent-history/svc-history");
    assert.strictEqual(usage.status, 200);
    assert.strictEqual(usage.body.total, 3);

    const events = await request(app).get("/api/v1/events?type=service.deleted");
    assert.strictEqual(events.status, 200);
    assert.strictEqual(events.body.items.length, 1);
    assert.strictEqual(events.body.items[0].type, "service.deleted");
    assert.deepStrictEqual(events.body.items[0].payload, {
      serviceId: "svc-history",
    });
  });

  void it("keeps the existing 404 shape when deleting an unknown service", async () => {
    const app = createApp();
    const requestId = "delete-missing-service";

    const deleted = await request(app)
      .delete("/api/v1/services/missing-service")
      .set("X-Request-Id", requestId);

    assert.strictEqual(deleted.status, 404);
    assert.strictEqual(deleted.body.error, "not_found");
    assert.strictEqual(deleted.body.requestId, requestId);
    assert.strictEqual(eventLog.length, 0);
  });
});
