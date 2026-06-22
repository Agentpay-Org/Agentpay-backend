import assert from "node:assert";
import { describe, it } from "node:test";
import request from "supertest";
import { app } from "./index.js";

const token = () => `csv-${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function recordUsage(agent: string, serviceId: string, requests = 1) {
  const res = await request(app)
    .post("/api/v1/usage")
    .send({ agent, serviceId, requests });
  assert.strictEqual(res.status, 201);
}

void describe("CSV usage export formula injection hardening", () => {
  void it("neutralizes formula prefixes in exported fields", async () => {
    const suffix = token();
    const cases = [
      { agent: `=${suffix}`, serviceId: `svc-eq-${suffix}`, expected: `'=${suffix}` },
      { agent: `+${suffix}`, serviceId: `svc-plus-${suffix}`, expected: `'+${suffix}` },
      {
        agent: `-${suffix}`,
        serviceId: `svc-minus-${suffix}`,
        expected: `'-${suffix}`,
      },
      { agent: `@${suffix}`, serviceId: `svc-at-${suffix}`, expected: `'@${suffix}` },
      {
        agent: `\t${suffix}`,
        serviceId: `svc-tab-${suffix}`,
        expected: `'\t${suffix}`,
      },
    ];

    for (const item of cases) {
      await recordUsage(item.agent, item.serviceId);
    }

    const csv = await request(app).get("/api/v1/usage/export.csv");
    assert.strictEqual(csv.status, 200);
    for (const item of cases) {
      assert.match(
        csv.text,
        new RegExp(`${escapeRegExp(item.expected)},${escapeRegExp(item.serviceId)},1`)
      );
    }
  });

  void it("preserves normal fields while escaping quotes, commas, and newlines", async () => {
    const suffix = token();
    const agent = `normal-${suffix}`;
    const serviceId = `svc,"line\n${suffix}`;

    await recordUsage(agent, serviceId, 2);

    const csv = await request(app).get("/api/v1/usage/export.csv");
    assert.strictEqual(csv.status, 200);
    assert.match(csv.text, new RegExp(`${agent},"svc,""line\\n${suffix}",2`));
  });

  void it("quotes and neutralizes carriage-return-prefixed fields", async () => {
    const suffix = token();
    const agent = `\r${suffix}`;
    const serviceId = `svc-cr-${suffix}`;

    await recordUsage(agent, serviceId, 1);

    const csv = await request(app).get("/api/v1/usage/export.csv");
    assert.strictEqual(csv.status, 200);
    assert.ok(csv.text.includes(`"'\r${suffix}",${serviceId},1`));
  });

  void it("neutralizes dangerous quoted fields and leaves JSON export unchanged", async () => {
    const suffix = token();
    const agent = `="cmd-${suffix}"`;
    const serviceId = `svc-json-${suffix}`;

    await recordUsage(agent, serviceId, 3);

    const csv = await request(app).get("/api/v1/usage/export.csv");
    assert.strictEqual(csv.status, 200);
    assert.match(csv.text, new RegExp(`"'=""cmd-${suffix}""",${serviceId},3`));

    const json = await request(app).get("/api/v1/usage/export.json");
    assert.strictEqual(json.status, 200);
    assert.ok(
      (json.body.items as { agent: string; serviceId: string; total: number }[]).some(
        (item) =>
          item.agent === agent && item.serviceId === serviceId && item.total === 3
      )
    );
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
