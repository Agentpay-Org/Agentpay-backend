import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import express from "express";
import { app as realApp } from "./index.js";
import { apiKeyStore } from "./store/state.js";
import {
  installPreRouteMiddleware,
  installRequestStateMiddleware,
} from "./middleware/index.js";
import type { AgentPayRequest } from "./types.js";

// We create a minimal test app that mounts the same middleware stack as the
// real app to act as our "test-only assertion path" for observing req.apiKey.
const testApp = express();
installPreRouteMiddleware(testApp);
installRequestStateMiddleware(testApp);
testApp.get("/_test/api-key", (req, res) => {
  res.json({ apiKey: (req as AgentPayRequest).apiKey });
});

void describe("API Key Recognition Middleware", () => {
  beforeEach(() => {
    apiKeyStore.clear();
  });

  void it("recognises a created key (case-insensitive header, exact value)", async () => {
    // 1. Create a key via the real app
    const createRes = await request(realApp)
      .post("/api/v1/api-keys")
      .send({ label: "recognition-test" });
    assert.strictEqual(createRes.status, 201);
    const key = createRes.body.key as string;
    assert.ok(key.startsWith("apk_"));

    // 2. Assert it is recognised via exact case
    const resExact = await request(testApp).get("/_test/api-key").set("X-API-Key", key);
    assert.strictEqual(resExact.body.apiKey, key);

    // 3. Assert it is recognised via lowercase header
    const resLower = await request(testApp).get("/_test/api-key").set("x-api-key", key);
    assert.strictEqual(resLower.body.apiKey, key);
  });

  void it("silently ignores an unknown key", async () => {
    const res = await request(testApp)
      .get("/_test/api-key")
      .set("X-API-Key", "apk_unknown123");
    assert.strictEqual(res.body.apiKey, undefined);
  });

  void it("leaves apiKey undefined if no key is provided", async () => {
    const res = await request(testApp).get("/_test/api-key");
    assert.strictEqual(res.body.apiKey, undefined);
  });

  void it("silently ignores a revoked key", async () => {
    const createRes = await request(realApp)
      .post("/api/v1/api-keys")
      .send({ label: "to-revoke" });
    const key = createRes.body.key as string;

    // Revoke the key
    const prefix = key.slice(0, 8);
    const delRes = await request(realApp).delete(`/api/v1/api-keys/${prefix}`);
    assert.strictEqual(delRes.status, 204);

    // Try to use the revoked key
    const res = await request(testApp).get("/_test/api-key").set("X-API-Key", key);
    assert.strictEqual(res.body.apiKey, undefined);
  });

  void it("ensures the API remains open: a write with no X-API-Key still succeeds", async () => {
    const res = await request(realApp)
      .post("/api/v1/usage")
      .send({ agent: "open-agent", serviceId: "open-service", requests: 1 });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.total, 1);
  });
});
