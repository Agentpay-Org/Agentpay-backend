import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";
import {
  apiKeyStore,
  pauseState,
  servicesDisabled,
  servicesMetadata,
  servicesStore,
  usageStore,
  webhookStore,
  serviceKey,
  parseServiceKey,
  usageKey,
  parseUsageKey,
} from "./store/state.js";
import { resolveTenantId, DEFAULT_TENANT_ID } from "./tenant.js";
import type { AgentPayRequest } from "./types.js";

let seq = 0;
const sid = () => `tenant-svc-${Date.now()}-${++seq}`;

async function createApiKey(label: string): Promise<string> {
  const res = await request(app).post("/api/v1/api-keys").send({ label });
  assert.strictEqual(res.status, 201);
  const key = res.body.key as unknown;
  if (typeof key !== "string") {
    throw new Error("expected API key response to include a string key");
  }
  assert.match(key, /^apk_/);
  return key;
}

beforeEach(() => {
  apiKeyStore.clear();
  servicesDisabled.clear();
  servicesMetadata.clear();
  servicesStore.clear();
  usageStore.clear();
  webhookStore.clear();
  pauseState.paused = false;
});

// ---------------------------------------------------------------------------
// Unit tests: tenant ID derivation and key encoding / parsing
// ---------------------------------------------------------------------------

void describe("resolveTenantId (unit)", () => {
  void it("returns the public tenant when apiKeyHash is missing", () => {
    const req = {} as AgentPayRequest;
    assert.strictEqual(resolveTenantId(req), DEFAULT_TENANT_ID);
  });

  void it("returns the public tenant when apiKeyHash is an empty string", () => {
    const req = { apiKeyHash: "" } as AgentPayRequest;
    assert.strictEqual(resolveTenantId(req), DEFAULT_TENANT_ID);
  });

  void it("returns api:<hash> when apiKeyHash is populated", () => {
    const hash = "a".repeat(64); // SHA-256 hex is 64 chars
    const req = { apiKeyHash: hash } as AgentPayRequest;
    assert.strictEqual(resolveTenantId(req), `api:${hash}`);
  });

  void it("prefixes any non-empty hash with 'api:'", () => {
    const req = { apiKeyHash: "deadbeef" } as AgentPayRequest;
    assert.strictEqual(resolveTenantId(req), "api:deadbeef");
  });
});

void describe("serviceKey / parseServiceKey (unit)", () => {
  void it("returns plain serviceId for the public tenant (backward compat)", () => {
    assert.strictEqual(serviceKey(DEFAULT_TENANT_ID, "my-svc"), "my-svc");
  });

  void it("returns tenant\x1fserviceId for a non-public tenant", () => {
    const key = serviceKey("api:abc123", "my-svc");
    assert.strictEqual(key, "api:abc123\x1fmy-svc");
  });

  void it("round-trips through parseServiceKey for a tenant key", () => {
    const key = serviceKey("api:abc123", "my-svc");
    const parsed = parseServiceKey(key);
    assert.deepStrictEqual(parsed, {
      tenantId: "api:abc123",
      serviceId: "my-svc",
    });
  });

  void it("round-trips through parseServiceKey for a public key", () => {
    const key = serviceKey(DEFAULT_TENANT_ID, "my-svc");
    const parsed = parseServiceKey(key);
    assert.deepStrictEqual(parsed, {
      tenantId: DEFAULT_TENANT_ID,
      serviceId: "my-svc",
    });
  });

  void it("parseServiceKey treats keys without separator as public", () => {
    assert.deepStrictEqual(parseServiceKey("plain-svc"), {
      tenantId: DEFAULT_TENANT_ID,
      serviceId: "plain-svc",
    });
  });

  void it("parseServiceKey handles keys with multiple separators (splits on first)", () => {
    const parsed = parseServiceKey("api:abc\x1fpre\x1fpost");
    assert.deepStrictEqual(parsed, {
      tenantId: "api:abc",
      serviceId: "pre\x1fpost",
    });
  });
});

void describe("usageKey / parseUsageKey (unit)", () => {
  void it("returns agent::svc for the legacy 2-arg form", () => {
    assert.strictEqual(usageKey("agent", "svc"), "agent::svc");
  });

  void it("returns agent::serviceId for the public tenant (backward compat)", () => {
    assert.strictEqual(usageKey(DEFAULT_TENANT_ID, "agent", "svc"), "agent::svc");
  });

  void it("returns tenant\x1fagent::serviceId for a non-public tenant", () => {
    const key = usageKey("api:abc123", "agent", "svc");
    assert.strictEqual(key, "api:abc123\x1fagent::svc");
  });

  void it("round-trips through parseUsageKey for a tenant key", () => {
    const key = usageKey("api:abc123", "agent", "svc");
    const parsed = parseUsageKey(key);
    assert.deepStrictEqual(parsed, {
      tenantId: "api:abc123",
      agent: "agent",
      serviceId: "svc",
    });
  });

  void it("round-trips through parseUsageKey for a public key", () => {
    const key = usageKey(DEFAULT_TENANT_ID, "agent", "svc");
    const parsed = parseUsageKey(key);
    assert.deepStrictEqual(parsed, {
      tenantId: DEFAULT_TENANT_ID,
      agent: "agent",
      serviceId: "svc",
    });
  });

  void it("parseUsageKey treats keys without separator as public", () => {
    assert.deepStrictEqual(parseUsageKey("agent::svc"), {
      tenantId: DEFAULT_TENANT_ID,
      agent: "agent",
      serviceId: "svc",
    });
  });

  void it("parseUsageKey handles agent ids containing double-colons", () => {
    // split("::") splits on all occurrences; destructuring grabs only first
    // two elements, so serviceId is the second segment.
    const parsed = parseUsageKey("api:abc\x1fagent::sub::svc");
    assert.deepStrictEqual(parsed, {
      tenantId: "api:abc",
      agent: "agent",
      serviceId: "sub",
    });
  });
});

void describe("Key encoding isolation (unit)", () => {
  void it("parseServiceKey handles key starting with separator", () => {
    const parsed = parseServiceKey("\x1fweird");
    assert.deepStrictEqual(parsed, {
      tenantId: "",
      serviceId: "weird",
    });
  });

  void it("parseUsageKey handles key starting with separator", () => {
    const parsed = parseUsageKey("\x1fagent::svc");
    assert.deepStrictEqual(parsed, {
      tenantId: "",
      agent: "agent",
      serviceId: "svc",
    });
  });

  void it("serviceKey for different tenants produce different keys", () => {
    const k1 = serviceKey("api:aaa", "svc");
    const k2 = serviceKey("api:bbb", "svc");
    assert.notStrictEqual(k1, k2);
  });

  void it("usageKey for different tenants produce different keys", () => {
    const k1 = usageKey("api:aaa", "agent", "svc");
    const k2 = usageKey("api:bbb", "agent", "svc");
    assert.notStrictEqual(k1, k2);
  });

  void it("public tenant keys are identical to historic flat format", () => {
    // These must stay true so existing data isn't orphaned after the tenant
    // feature is deployed.
    assert.strictEqual(
      serviceKey(DEFAULT_TENANT_ID, "svc"),
      "svc"
    );
    assert.strictEqual(
      usageKey(DEFAULT_TENANT_ID, "agent", "svc"),
      "agent::svc"
    );
  });
});

// ---------------------------------------------------------------------------
// Integration tests: tenant isolation via HTTP API
// ---------------------------------------------------------------------------

void describe("Tenant scoping", () => {
  void it("lets different API-key tenants register the same serviceId independently", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const serviceId = sid();

    const createA = await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId, priceStroops: 10 });
    assert.strictEqual(createA.status, 201);

    const createB = await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyB)
      .send({ serviceId, priceStroops: 20 });
    assert.strictEqual(createB.status, 201);

    const readA = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", keyA);
    assert.strictEqual(readA.status, 200);
    assert.strictEqual(readA.body.priceStroops, 10);

    const readB = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", keyB);
    assert.strictEqual(readB.status, 200);
    assert.strictEqual(readB.body.priceStroops, 20);

    const readPublic = await request(app).get(`/api/v1/services/${serviceId}`);
    assert.strictEqual(readPublic.status, 404);
    assert.strictEqual(readPublic.body.error, "not_found");

    const listA = await request(app).get("/api/v1/services").set("X-API-Key", keyA);
    const listB = await request(app).get("/api/v1/services").set("X-API-Key", keyB);
    assert.deepStrictEqual(listA.body.services, [
      { serviceId, priceStroops: 10, disabled: false },
    ]);
    assert.deepStrictEqual(listB.body.services, [
      { serviceId, priceStroops: 20, disabled: false },
    ]);
  });

  void it("returns 404 for cross-tenant service mutations without leaking existence", async () => {
    const ownerKey = await createApiKey("owner");
    const otherKey = await createApiKey("other");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", ownerKey)
      .send({ serviceId, priceStroops: 100 })
      .expect(201);

    const price = await request(app)
      .patch(`/api/v1/services/${serviceId}/price`)
      .set("X-API-Key", otherKey)
      .send({ priceStroops: 250 });
    assert.strictEqual(price.status, 404);
    assert.strictEqual(price.body.error, "not_found");

    const metadata = await request(app)
      .put(`/api/v1/services/${serviceId}/metadata`)
      .set("X-API-Key", otherKey)
      .send({ description: "hidden", owner: "other" });
    assert.strictEqual(metadata.status, 404);
    assert.strictEqual(metadata.body.error, "not_found");

    const disabled = await request(app)
      .patch(`/api/v1/services/${serviceId}/disabled`)
      .set("X-API-Key", otherKey)
      .send({ disabled: true });
    assert.strictEqual(disabled.status, 404);
    assert.strictEqual(disabled.body.error, "not_found");

    const deleted = await request(app)
      .delete(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", otherKey);
    assert.strictEqual(deleted.status, 404);
    assert.strictEqual(deleted.body.error, "not_found");

    const ownerRead = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", ownerKey);
    assert.strictEqual(ownerRead.status, 200);
    assert.strictEqual(ownerRead.body.priceStroops, 100);
    assert.strictEqual(ownerRead.body.disabled, false);
  });

  void it("keeps usage rollups and settlement isolated by tenant", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId, priceStroops: 5 })
      .expect(201);
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyB)
      .send({ serviceId, priceStroops: 7 })
      .expect(201);

    await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", keyA)
      .send({ agent: "agent-1", serviceId, requests: 3 })
      .expect(201);
    await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", keyB)
      .send({ agent: "agent-1", serviceId, requests: 2 })
      .expect(201);

    const rollupA = await request(app)
      .get(`/api/v1/services/${serviceId}/usage`)
      .set("X-API-Key", keyA);
    assert.deepStrictEqual(rollupA.body, { serviceId, total: 3, agents: 1 });

    const rollupB = await request(app)
      .get(`/api/v1/services/${serviceId}/usage`)
      .set("X-API-Key", keyB);
    assert.deepStrictEqual(rollupB.body, { serviceId, total: 2, agents: 1 });

    const settleB = await request(app)
      .post("/api/v1/settle")
      .set("X-API-Key", keyB)
      .send({ agent: "agent-1", serviceId });
    assert.strictEqual(settleB.status, 200);
    assert.strictEqual(settleB.body.requests, 2);
    assert.strictEqual(settleB.body.billedStroops, 14);

    // After settling tenant B, tenant A's usage rollup is unchanged
    const rollupAAfter = await request(app)
      .get(`/api/v1/services/${serviceId}/usage`)
      .set("X-API-Key", keyA);
    assert.strictEqual(rollupAAfter.body.total, 3);

    const settleA = await request(app)
      .post("/api/v1/settle")
      .set("X-API-Key", keyA)
      .send({ agent: "agent-1", serviceId });
    assert.strictEqual(settleA.status, 200);
    assert.strictEqual(settleA.body.requests, 3);
    assert.strictEqual(settleA.body.billedStroops, 15);
  });

  void it("keeps the legacy public tenant separate from API-key tenants", async () => {
    const key = await createApiKey("tenant");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .send({ serviceId, priceStroops: 11 })
      .expect(201);
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "public-agent", serviceId, requests: 4 })
      .expect(201);

    const keyedRead = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", key);
    assert.strictEqual(keyedRead.status, 404);
    assert.strictEqual(keyedRead.body.error, "not_found");

    // Keyed tenant sees zero usage via the service rollup
    const keyedRollup = await request(app)
      .get(`/api/v1/services/${serviceId}/usage`)
      .set("X-API-Key", key);
    assert.strictEqual(keyedRollup.body.total, 0);

    // Public tenant sees its own usage
    const publicRollup = await request(app).get(
      `/api/v1/services/${serviceId}/usage`
    );
    assert.strictEqual(publicRollup.body.total, 4);
  });

  void it("isolates service disabled state between tenants", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId, priceStroops: 1 })
      .expect(201);
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyB)
      .send({ serviceId, priceStroops: 1 })
      .expect(201);

    // Disable in tenant A
    await request(app)
      .patch(`/api/v1/services/${serviceId}/disabled`)
      .set("X-API-Key", keyA)
      .send({ disabled: true })
      .expect(200);

    // Tenant A reads it as disabled
    const readA = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", keyA);
    assert.strictEqual(readA.body.disabled, true);

    // Tenant B still sees it as enabled
    const readB = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", keyB);
    assert.strictEqual(readB.body.disabled, false);

    // Tenant B can still record usage against it
    const usageB = await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", keyB)
      .send({ agent: "agent", serviceId, requests: 1 });
    assert.strictEqual(usageB.status, 201);

    // Tenant A gets 409 for usage because the service is disabled in their
    // tenant
    const usageA = await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", keyA)
      .send({ agent: "agent", serviceId, requests: 1 });
    assert.strictEqual(usageA.status, 409);
    assert.strictEqual(usageA.body.error, "service_disabled");
  });

  void it("isolates service metadata between tenants", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId, priceStroops: 1 })
      .expect(201);
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyB)
      .send({ serviceId, priceStroops: 1 })
      .expect(201);

    await request(app)
      .put(`/api/v1/services/${serviceId}/metadata`)
      .set("X-API-Key", keyA)
      .send({ description: "Tenant A service", owner: "owner-a" })
      .expect(200);

    // Tenant A sees their own metadata
    const readMetaA = await request(app)
      .get(`/api/v1/services/${serviceId}/metadata`)
      .set("X-API-Key", keyA);
    assert.strictEqual(readMetaA.body.description, "Tenant A service");
    assert.strictEqual(readMetaA.body.owner, "owner-a");

    // Tenant B has no metadata (404 because metadata was never set for their
    // tenant)
    const readMetaB = await request(app)
      .get(`/api/v1/services/${serviceId}/metadata`)
      .set("X-API-Key", keyB);
    assert.strictEqual(readMetaB.status, 404);
  });

  void it("filters top-N agents by tenant", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId, priceStroops: 1 })
      .expect(201);
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyB)
      .send({ serviceId, priceStroops: 1 })
      .expect(201);

    await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", keyA)
      .send({ agent: "agent-a", serviceId, requests: 5 })
      .expect(201);
    await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", keyB)
      .send({ agent: "agent-b", serviceId, requests: 1 })
      .expect(201);

    const topA = await request(app)
      .get(`/api/v1/services/${serviceId}/agents/top`)
      .set("X-API-Key", keyA);
    assert.strictEqual(topA.body.items.length, 1);
    assert.strictEqual(topA.body.items[0].agent, "agent-a");
    assert.strictEqual(topA.body.items[0].total, 5);

    const topB = await request(app)
      .get(`/api/v1/services/${serviceId}/agents/top`)
      .set("X-API-Key", keyB);
    assert.strictEqual(topB.body.items.length, 1);
    assert.strictEqual(topB.body.items[0].agent, "agent-b");
    assert.strictEqual(topB.body.items[0].total, 1);
  });

  void it("deleting a service in one tenant does not affect the other", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId, priceStroops: 1 })
      .expect(201);
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyB)
      .send({ serviceId, priceStroops: 2 })
      .expect(201);

    await request(app)
      .delete(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", keyA)
      .expect(204);

    // Tenant A can no longer read it
    await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", keyA)
      .expect(404);

    // Tenant B still has it intact
    const readB = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", keyB);
    assert.strictEqual(readB.status, 200);
    assert.strictEqual(readB.body.priceStroops, 2);
  });

  void it("isolates settlement billing between tenants", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId, priceStroops: 10 })
      .expect(201);
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyB)
      .send({ serviceId, priceStroops: 100 })
      .expect(201);

    await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", keyA)
      .send({ agent: "agent", serviceId, requests: 5 })
      .expect(201);
    await request(app)
      .post("/api/v1/usage")
      .set("X-API-Key", keyB)
      .send({ agent: "agent", serviceId, requests: 2 })
      .expect(201);

    // Settlement is tenant-scoped and returns billedStroops
    const settleA = await request(app)
      .post("/api/v1/settle")
      .set("X-API-Key", keyA)
      .send({ agent: "agent", serviceId });
    assert.strictEqual(settleA.body.billedStroops, 50);

    const settleB = await request(app)
      .post("/api/v1/settle")
      .set("X-API-Key", keyB)
      .send({ agent: "agent", serviceId });
    assert.strictEqual(settleB.body.billedStroops, 200);
  });

  void it("service list filtered by tenant", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId: sid(), priceStroops: 1 })
      .expect(201);
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId: sid(), priceStroops: 1 })
      .expect(201);
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyB)
      .send({ serviceId: sid(), priceStroops: 1 })
      .expect(201);

    const listA = await request(app)
      .get("/api/v1/services")
      .set("X-API-Key", keyA);
    assert.strictEqual(listA.body.services.length, 2);

    const listB = await request(app)
      .get("/api/v1/services")
      .set("X-API-Key", keyB);
    assert.strictEqual(listB.body.services.length, 1);

    const listPublic = await request(app).get("/api/v1/services");
    assert.strictEqual(listPublic.body.services.length, 0);
  });

  void it("change price in one tenant does not affect another", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId, priceStroops: 10 })
      .expect(201);
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyB)
      .send({ serviceId, priceStroops: 20 })
      .expect(201);

    await request(app)
      .patch(`/api/v1/services/${serviceId}/price`)
      .set("X-API-Key", keyA)
      .send({ priceStroops: 99 })
      .expect(200);

    const readA = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", keyA);
    assert.strictEqual(readA.body.priceStroops, 99);

    const readB = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", keyB);
    assert.strictEqual(readB.body.priceStroops, 20);
  });

  // -----------------------------------------------------------------------
  // Bulk operation tenant isolation
  // -----------------------------------------------------------------------

  void it("bulk service registration scoped by tenant", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const svc1 = sid();
    const svc2 = sid();

    await request(app)
      .post("/api/v1/services/bulk")
      .set("X-API-Key", keyA)
      .send({
        items: [
          { serviceId: svc1, priceStroops: 10 },
          { serviceId: svc2, priceStroops: 20 },
        ],
      })
      .expect(201);

    // Tenant B does not see the services
    const readB1 = await request(app)
      .get(`/api/v1/services/${svc1}`)
      .set("X-API-Key", keyB);
    assert.strictEqual(readB1.status, 404);

    // Tenant A sees both
    const listA = await request(app)
      .get("/api/v1/services")
      .set("X-API-Key", keyA);
    assert.strictEqual(listA.body.services.length, 2);
  });

  void it("bulk usage scoped by tenant", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", keyA)
      .send({ serviceId, priceStroops: 1 })
      .expect(201);

    await request(app)
      .post("/api/v1/usage/bulk")
      .set("X-API-Key", keyA)
      .send({
        items: [
          { agent: "agent-1", serviceId, requests: 10 },
          { agent: "agent-2", serviceId, requests: 5 },
        ],
      })
      .expect(201);

    const rollupA = await request(app)
      .get(`/api/v1/services/${serviceId}/usage`)
      .set("X-API-Key", keyA);
    assert.strictEqual(rollupA.body.total, 15);
    assert.strictEqual(rollupA.body.agents, 2);

    // Tenant B sees zero usage for the same service
    const rollupB = await request(app)
      .get(`/api/v1/services/${serviceId}/usage`)
      .set("X-API-Key", keyB);
    assert.strictEqual(rollupB.body.total, 0);
  });

  // -----------------------------------------------------------------------
  // Webhooks are NOT isolated (documented limitation)
  // -----------------------------------------------------------------------

  void it("webhooks are shared across tenants (documented limitation)", async () => {
    const keyA = await createApiKey("tenant-a");
    const keyB = await createApiKey("tenant-b");

    // Tenant A creates a webhook
    const create = await request(app)
      .post("/api/v1/webhooks")
      .set("X-API-Key", keyA)
      .send({
        url: "https://a.example.com/hook",
        events: ["usage.recorded"],
      });
    assert.strictEqual(create.status, 201);
    const webhookId = create.body.id as string;
    assert.ok(typeof webhookId === "string" && webhookId.length > 0);

    // Tenant B can see it
    const listB = await request(app)
      .get("/api/v1/webhooks")
      .set("X-API-Key", keyB);
    assert.ok(listB.body.items.some((w: { id: string }) => w.id === webhookId));

    // Tenant B can fetch it directly
    const getB = await request(app)
      .get(`/api/v1/webhooks/${webhookId}`)
      .set("X-API-Key", keyB);
    assert.strictEqual(getB.status, 200);

    // Tenant B can patch it
    await request(app)
      .patch(`/api/v1/webhooks/${webhookId}`)
      .set("X-API-Key", keyB)
      .send({ url: "https://b.example.com/hook" })
      .expect(200);

    // Verify the patch took effect
    const getAfter = await request(app).get(
      `/api/v1/webhooks/${webhookId}`
    );
    assert.strictEqual(getAfter.body.url, "https://b.example.com/hook");

    // An unauthenticated caller can also see the webhook
    const publicList = await request(app).get("/api/v1/webhooks");
    assert.ok(
      publicList.body.items.some((w: { id: string }) => w.id === webhookId)
    );

    // Tenant B can delete the webhook created by tenant A
    await request(app)
      .delete(`/api/v1/webhooks/${webhookId}`)
      .set("X-API-Key", keyB)
      .expect(204);

    // It's gone for everyone
    await request(app).get(`/api/v1/webhooks/${webhookId}`).expect(404);
  });

  // -----------------------------------------------------------------------
  // Public tenant isolation
  // -----------------------------------------------------------------------

  void it("public tenant cannot see services from API-key tenants even with same id", async () => {
    const key = await createApiKey("tenant");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", key)
      .send({ serviceId, priceStroops: 42 })
      .expect(201);

    // Public request to same serviceId returns 404
    await request(app).get(`/api/v1/services/${serviceId}`).expect(404);

    // Public listing does not include the keyed tenant's service
    const pubList = await request(app).get("/api/v1/services");
    assert.strictEqual(pubList.body.services.length, 0);
  });

  void it("public tenant usage does not leak into API-key tenant billing", async () => {
    const key = await createApiKey("tenant");
    const serviceId = sid();

    // Register in the public tenant
    await request(app)
      .post("/api/v1/services")
      .send({ serviceId, priceStroops: 10 })
      .expect(201);
    await request(app)
      .post("/api/v1/usage")
      .send({ agent: "pub-agent", serviceId, requests: 100 })
      .expect(201);

    // Register the same serviceId in the keyed tenant
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", key)
      .send({ serviceId, priceStroops: 10 })
      .expect(201);

    // Keyed tenant settlement shows zero usage (separate counters)
    const keyedSettle = await request(app)
      .post("/api/v1/settle")
      .set("X-API-Key", key)
      .send({ agent: "pub-agent", serviceId });
    assert.strictEqual(keyedSettle.body.requests, 0);
    assert.strictEqual(keyedSettle.body.billedStroops, 0);

    // Public tenant settlement bills its own usage
    const pubSettle = await request(app)
      .post("/api/v1/settle")
      .send({ agent: "pub-agent", serviceId });
    assert.strictEqual(pubSettle.body.requests, 100);
    assert.strictEqual(pubSettle.body.billedStroops, 1000);
  });

  // -----------------------------------------------------------------------
  // Service deletion isolation
  // -----------------------------------------------------------------------

  void it("deleting a public-tenant service leaves keyed-tenant service intact", async () => {
    const key = await createApiKey("tenant");
    const serviceId = sid();

    await request(app)
      .post("/api/v1/services")
      .send({ serviceId, priceStroops: 10 })
      .expect(201);
    await request(app)
      .post("/api/v1/services")
      .set("X-API-Key", key)
      .send({ serviceId, priceStroops: 20 })
      .expect(201);

    await request(app).delete(`/api/v1/services/${serviceId}`).expect(204);

    // Public is gone
    await request(app).get(`/api/v1/services/${serviceId}`).expect(404);

    // Keyed still exists
    const keyedRead = await request(app)
      .get(`/api/v1/services/${serviceId}`)
      .set("X-API-Key", key);
    assert.strictEqual(keyedRead.status, 200);
    assert.strictEqual(keyedRead.body.priceStroops, 20);
  });
});
