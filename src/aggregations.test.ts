import { describe, it } from "node:test";
import assert from "node:assert";
import request from "supertest";
import { app } from "./index.js";

let seq = 0;
const unique = (label: string) => `agg-${Date.now()}-${++seq}-${label}`;

type AgentUsageItem = {
  serviceId?: unknown;
  total?: unknown;
};

type ServiceAgentItem = {
  agent?: unknown;
  total?: unknown;
};

async function recordUsage(agent: string, serviceId: string, requests: number) {
  const res = await request(app)
    .post("/api/v1/usage")
    .send({ agent, serviceId, requests });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.total, requests);
}

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

void describe("Usage aggregations and exports", () => {
  void it("rolls usage up by agent and service with deterministic top ordering", async () => {
    const serviceA = unique("svc-a");
    const serviceB = unique("svc-b");
    const alpha = unique("agent-alpha");
    const beta = unique("agent-beta");
    const gamma = unique("agent-gamma");

    await recordUsage(alpha, serviceA, 3);
    await recordUsage(beta, serviceA, 7);
    await recordUsage(gamma, serviceA, 2);
    await recordUsage(alpha, serviceB, 5);

    const agents = await request(app).get("/api/v1/agents?limit=1000");
    assert.strictEqual(agents.status, 200);
    assert.ok((agents.body.agents as string[]).includes(alpha));
    assert.ok((agents.body.agents as string[]).includes(beta));
    assert.ok((agents.body.agents as string[]).includes(gamma));

    const alphaTotal = await request(app).get(`/api/v1/agents/${alpha}/total`);
    assert.strictEqual(alphaTotal.status, 200);
    assert.deepStrictEqual(alphaTotal.body, { agent: alpha, total: 8 });

    const alphaUsage = await request(app).get(`/api/v1/agents/${alpha}/usage`);
    assert.strictEqual(alphaUsage.status, 200);
    const alphaItems = alphaUsage.body.items as AgentUsageItem[];
    assert.ok(
      alphaItems.some((item) => item.serviceId === serviceA && item.total === 3)
    );
    assert.ok(
      alphaItems.some((item) => item.serviceId === serviceB && item.total === 5)
    );

    const missingAgentUsage = await request(app).get(
      `/api/v1/agents/${unique("missing-agent")}/usage`
    );
    assert.strictEqual(missingAgentUsage.status, 200);
    assert.deepStrictEqual(missingAgentUsage.body.items, []);

    const missingAgentTotal = await request(app).get(
      `/api/v1/agents/${unique("missing-agent")}/total`
    );
    assert.strictEqual(missingAgentTotal.status, 200);
    assert.strictEqual(missingAgentTotal.body.total, 0);

    const serviceUsage = await request(app).get(`/api/v1/services/${serviceA}/usage`);
    assert.strictEqual(serviceUsage.status, 200);
    assert.deepStrictEqual(serviceUsage.body, {
      serviceId: serviceA,
      total: 12,
      agents: 3,
    });

    const serviceAgents = await request(app).get(`/api/v1/services/${serviceA}/agents`);
    assert.strictEqual(serviceAgents.status, 200);
    const serviceItems = serviceAgents.body.items as ServiceAgentItem[];
    assert.ok(serviceItems.some((item) => item.agent === alpha && item.total === 3));
    assert.ok(serviceItems.some((item) => item.agent === beta && item.total === 7));
    assert.ok(serviceItems.some((item) => item.agent === gamma && item.total === 2));

    const topTwo = await request(app).get(
      `/api/v1/services/${serviceA}/agents/top?limit=2`
    );
    assert.strictEqual(topTwo.status, 200);
    assert.deepStrictEqual(topTwo.body.items, [
      { agent: beta, total: 7 },
      { agent: alpha, total: 3 },
    ]);

    const lowClamp = await request(app).get(
      `/api/v1/services/${serviceA}/agents/top?limit=0`
    );
    assert.strictEqual(lowClamp.status, 200);
    assert.deepStrictEqual(lowClamp.body.items, [{ agent: beta, total: 7 }]);

    const soloService = unique("solo-svc");
    const soloAgent = unique("solo-agent");
    await recordUsage(soloAgent, soloService, 4);
    const solo = await request(app).get(`/api/v1/services/${soloService}/usage`);
    assert.deepStrictEqual(solo.body, { serviceId: soloService, total: 4, agents: 1 });
  });

  void it("exports usage as escaped CSV and timestamped JSON tuples", async () => {
    const agent = `${unique("agent")}, "quoted"\nline`;
    const serviceId = `${unique("svc")}, "quoted"\nline`;
    await recordUsage(agent, serviceId, 9);

    const csv = await request(app).get("/api/v1/usage/export.csv");
    assert.strictEqual(csv.status, 200);
    assert.ok(csv.headers["content-type"].startsWith("text/csv"));
    assert.ok(csv.text.startsWith("agent,serviceId,total\n"));
    const expectedCsvRow = `${csvEscape(agent)},${csvEscape(serviceId)},9`;
    assert.ok(csv.text.includes(expectedCsvRow));

    const json = await request(app).get("/api/v1/usage/export.json");
    assert.strictEqual(json.status, 200);
    assert.strictEqual(typeof json.body.exportedAt, "number");
    assert.ok(json.body.exportedAt > 0);
    const items = json.body.items as {
      agent?: unknown;
      serviceId?: unknown;
      total?: unknown;
    }[];
    assert.ok(
      items.some(
        (item) =>
          item.agent === agent && item.serviceId === serviceId && item.total === 9
      )
    );
  });
});
