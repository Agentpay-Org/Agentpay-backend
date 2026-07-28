import { beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { createApp } from "./index.js";
import { eventLog } from "./events.js";
import {
  pauseState,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
} from "./store/state.js";
import { validateAgentRequest } from "./routes/usage.js";

beforeEach(() => {
  pauseState.paused = false;
  usageStore.clear();
  servicesStore.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  eventLog.length = 0;
});

void describe("shared agent validation", () => {
  void it("returns the shared agent validation result for safe and unsafe ids", () => {
    assert.deepStrictEqual(validateAgentRequest("agent-safe"), {
      ok: true,
      value: "agent-safe",
    });
    assert.deepStrictEqual(validateAgentRequest(""), {
      ok: false,
      message: "agent must be a safe identifier",
    });
    assert.deepStrictEqual(validateAgentRequest("agent::bad"), {
      ok: false,
      message: "agent must be a safe identifier",
    });
  });

  void it("keeps agent-only handlers on the same invalid_request shape", async () => {
    const app = createApp();

    const total = await request(app).get("/api/v1/agents/agent::bad/total");
    assert.strictEqual(total.status, 400);
    assert.deepStrictEqual(total.body.error, "invalid_request");
    assert.strictEqual(total.body.message, "agent and serviceId must be safe identifiers");

    const bulkSettle = await request(app)
      .post("/api/v1/settle/bulk")
      .send({ agent: "agent::bad" });
    assert.strictEqual(bulkSettle.status, 400);
    assert.deepStrictEqual(bulkSettle.body.error, "invalid_request");
    assert.strictEqual(bulkSettle.body.message, "agent must be a safe identifier");
  });
});
